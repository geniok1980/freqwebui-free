"""
Strategy Lab API for Multibotdashboard V6
Integrates ftmanager workflow engine with dashboard
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import asyncio
import json
import os
import logging
import re
import subprocess  # ADD THIS
import time
from datetime import datetime

logger = logging.getLogger(__name__)

from src.models import get_db
from src.models.bot import Bot
from src.schemas.bot import BotResponse
from src.api.deps import require_operator

router = APIRouter(prefix="/strategy-lab", tags=["strategy-lab"])

# Import ftmanager components
from src.services.ftmanager.state import AppState, ProcessType, ProcessStatus
from src.services.ftmanager.workflow import Workflow
from src.services.ftmanager.hyperopt_monitor import HyperoptMonitor
from src.services.ftmanager.process_manager import ProcessManager
from src.services.ftmanager.config import AppConfig, StrategyConfig

# Global state (initialized on startup)
app_state: Optional[AppState] = None
workflow_engine: Optional[Workflow] = None
hyperopt_monitor: Optional[HyperoptMonitor] = None
proc_mgr: Optional[ProcessManager] = None
async def async_subprocess_run(cmd, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: subprocess.run(cmd, **kwargs))


def _get_strategies_root() -> str:
    candidates: list[str] = []
    env_path = os.getenv("STRATEGIES_PATH") or os.getenv("DASHBOARD_STRATEGIES_PATH")
    if env_path:
        candidates.append(env_path)
    candidates.extend(
        [
            "/opt/Multibotdashboard/Strategies",
            "/app/Strategies",
            "/opt/MultibotdashboardV5/Strategies",
        ]
    )
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return candidates[0]



@router.on_event("startup")
async def startup_strategy_lab():
    """Initialize ftmanager components on startup"""
    global app_state, workflow_engine, hyperopt_monitor, proc_mgr
    
    # Create default config (customize as needed)
    config = AppConfig(
        freqtrade_dir="/opt/Freqtrade",
        strategies=[]
    )
    
    app_state = AppState()
    proc_mgr = ProcessManager(config, app_state)
    hyperopt_monitor = HyperoptMonitor(config, app_state)
    workflow_engine = Workflow(config, app_state, proc_mgr, hyperopt_monitor)
    
    # Start hyperopt file watcher
    # Note: start_monitoring requires strategy_name, called per-strategy when needed
    # asyncio.create_task(hyperopt_monitor.start_monitoring("default"))


@router.get("/strategies")
async def get_strategies(
    session: AsyncSession = Depends(get_db)
) -> List[dict]:
    """Get all strategies by scanning Strategies folder"""
    strategies = []
    strategies_path = _get_strategies_root()
    
    print(f"DEBUG: Looking for strategies at: {strategies_path}", flush=True)
    
    if not os.path.exists(strategies_path):
        print(f"DEBUG: Path does not exist: {strategies_path}", flush=True)
        return []
    
    py_files_found = 0
    for root, dirs, files in os.walk(strategies_path):
        print(f"DEBUG: Scanning {root}, files: {len(files)}", flush=True)
        for file in files:
            if file.endswith('.py') and not file.startswith('__'):
                py_files_found += 1
                file_path = os.path.join(root, file)
                strategy_name = file[:-3]  # Remove .py
                
                # Extract family from path (e.g., AlexKasuari from AlexKasuari/V1)
                rel_path = os.path.relpath(file_path, strategies_path)
                path_parts = rel_path.split(os.sep)
                family = path_parts[0] if len(path_parts) > 1 else 'Other'
                
                # Try to extract version from path (e.g., V2, V3)
                version = ""
                for part in path_parts:
                    if part.upper().startswith('V') and part[1:].isdigit():
                        version = part
                        break
                
                strategies.append({
                    "name": strategy_name,
                    "family": family,
                    "file_path": file_path,
                    "version": version,
                    "description": "",
                    "entry_type": "unknown",
                    "exit_type": "unknown",
                    "has_custom_exit": False,
                    "has_trailing_stop": False,
                    "indicators": [],
                    "optimizable_params": [],
                    "ml_features": []
                })
    
    print(f"DEBUG: Total .py files found: {py_files_found}, strategies added: {len(strategies)}", flush=True)
    strategies.sort(key=lambda x: x["name"])
    return strategies


def _sanitize_strategy_filename(filename: str) -> str:
    base = os.path.basename(filename or "").strip()
    if not base:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")
    if not base.lower().endswith(".py"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .py files are allowed")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+\.py", base):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    return base


def _sanitize_strategy_family(family: str | None) -> str:
    f = (family or "").strip()
    if not f:
        return "Custom"
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", f):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid family name")
    return f


@router.post("/strategies/upload")
async def upload_strategy(
    file: UploadFile = File(...),
    family: str | None = Form(None),
    _: object = Depends(require_operator),
) -> dict:
    strategies_root = _get_strategies_root()
    filename = _sanitize_strategy_filename(file.filename)
    family_dir = _sanitize_strategy_family(family)

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > 512 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 512KB)")

    dest_dir = os.path.join(strategies_root, family_dir)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, filename)

    try:
        with open(dest_path, "wb") as f:
            f.write(data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save file: {e}")

    return {
        "status": "success",
        "data": {
            "strategy_name": filename[:-3],
            "family": family_dir,
            "path": dest_path,
        },
    }



@router.get("/bots/{bot_id}/workflow-status")
async def get_workflow_status(
    bot_id: str,
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Get current workflow status for a bot"""
    if not app_state:
        raise HTTPException(status_code=503, detail="Strategy Lab not initialized")
    
    # Get bot to find its strategy name
    result = await session.get(Bot, bot_id)
    if not result:
        return {"status": "idle", "message": "Bot not found"}
    
    bot = result
    strategy_name = bot.strategy or bot.name
    
    # Check workflow status for this strategy
    process = app_state.get_process(ProcessType.HYPEROPT, strategy_name)
    if not process:
        process = app_state.get_process(ProcessType.BACKTEST, strategy_name)
    
    if not process:
        return {"status": "idle", "message": "No active workflow"}
    
    return {
        "status": process.status.value,
        "type": process.process_type.value,
        "started_at": process.started_at.isoformat() if process.started_at else None,
        "pid": process.pid,
        "stats": process.stats.to_dict() if process.stats else None
    }


@router.post("/workflow/start")
async def start_workflow(
    config: dict,  # Full config from frontend
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Start optimization workflow - spawn Docker container for backtest/hyperopt"""
    
    strategy_name = config.get('strategy')
    if not strategy_name:
        raise HTTPException(status_code=400, detail="Strategy name required")
    
    # Optional: associate with bot if provided
    bot_id = config.get('bot_id')
    bot_name = None
    if bot_id and bot_id != 'default':
        result = await session.get(Bot, bot_id)
        if result:
            bot_name = result.name
    steps = config.get('steps', [])
    epochs = config.get('epochs', 30)
    
    steps = config.get('steps', [])
    epochs = config.get('epochs', 30)
    
    logger.info(f"Starting workflow for strategy {strategy_name}, steps: {steps}")
    
    # Start workflow in background (non-blocking)
    import asyncio
    import subprocess
    import shutil
    
    async def run_workflow():
        try:
            logger.info(f"Workflow started for {strategy_name}")
            
            # Find strategy file and copy to freqtrade strategies folder
            freqtrade_strat_dir = "/opt/Freqtrade/user_data/strategies"
            os.makedirs(freqtrade_strat_dir, exist_ok=True)
            
            strategy_file_path = None
            strategy_class = strategy_name
            available_spaces = ["buy"]  # INITIALIZE HERE
            
            for root, dirs, files in os.walk("/opt/Multibotdashboard/Strategies"):
                for file in files:
                    if file == f"{strategy_name}.py":
                        strategy_file_path = os.path.join(root, file)
                        dest_path = os.path.join(freqtrade_strat_dir, file)
                        shutil.copy(strategy_file_path, dest_path)
                        logger.info(f"Copied strategy to {dest_path}")
                        try:
                            with open(strategy_file_path, 'r') as f:
                                content = f.read()
                                import re
                                # FIX: Find class that inherits from IStrategy, not just any class
                                # Pattern: class StrategyName(IStrategy) or class StrategyName(IStrategy, ...)
                                match = re.search(r'class\s+(\w+)\s*\(\s*IStrategy', content)
                                if match:
                                    strategy_class = match.group(1)
                                    logger.info(f"Found strategy class name: {strategy_class}")
                                else:
                                    # Fallback: look for class containing strategy name
                                    match = re.search(rf'class\s+({re.escape(strategy_name)}\w*)\s*\(', content)
                                    if match:
                                        strategy_class = match.group(1)
                                        logger.info(f"Found class by name: {strategy_class}")
                                    else:
                                        # Last resort: find any class that looks like a strategy
                                        matches = re.findall(r'class\s+(\w+)\s*\(', content)
                                        for m in matches:
                                            if 'Config' not in m and 'Plot' not in m:
                                                strategy_class = m
                                                logger.info(f"Found strategy class (fallback): {strategy_class}")
                                                break
                        except Exception as e:
                            logger.warning(f"Could not read strategy file: {e}")
                        break
                if strategy_file_path:
                    break
            
            if not strategy_file_path:
                logger.error(f"Strategy file not found: {strategy_name}.py")
                return
            
            # Build Docker command based on steps
            host_export_path = None
            if 'backtest' in steps:
                logger.info(f"Running backtest for {strategy_name}")
                
                results_dir = "/opt/Multibotdashboard/results/backtest"
                os.makedirs(results_dir, exist_ok=True)
                timestamp = int(time.time())
                # Use a path inside the container that freqtrade can write to
                container_export_path = f"/freqtrade/user_data/backtest_results/{strategy_name}_{timestamp}_export.json"
                host_export_path = f"{results_dir}/{strategy_name}_{timestamp}_export.json"
                
                cmd = [
                    "docker", "run",
                    "--name", f"backtest_{strategy_name}_{timestamp}",
                    "-v", f"{freqtrade_strat_dir}:/freqtrade/user_data/strategies",
                    "-v", "/opt/Freqtrade_data/data:/freqtrade/user_data/data",
                    "-v", "/opt/Freqtrade/user_data/config:/freqtrade/config",
                    "-v", "/opt/Freqtrade/user_data/logs:/freqtrade/user_data/logs",
                    "-v", f"{results_dir}:/freqtrade/user_data/backtest_results",
                    "freqtradeorg/freqtrade:stable_freqaitorch",
                    "backtesting",
                    "--strategy", strategy_class,
                    "--config", "/freqtrade/config/config-torch.json",
                    "--timerange", "20251001-20260221",
                    "--timeframe", "15m",
                    "--cache", "none",
                    "--export", "trades",
                    "--export-filename", container_export_path
                ]
                logger.info(f"Docker command: {' '.join(cmd)}")
                result = await async_subprocess_run(cmd, capture_output=True, text=True, timeout=3600)
                
                # ALWAYS save raw results first (for debugging)
                try:
                    raw_log_file = f"{results_dir}/{strategy_name}_{timestamp}_raw.log"
                    logger.info(f"Attempting to save raw log to: {raw_log_file}")
                    with open(raw_log_file, 'w') as f:
                        f.write("=== STDOUT ===\n")
                        f.write(result.stdout if result.stdout else "")
                        f.write("\n=== STDERR ===\n")
                        f.write(result.stderr if result.stderr else "")
                        f.write(f"\n=== RETURN CODE ===\n{result.returncode}")
                    logger.info(f"✅ Saved raw backtest log to {raw_log_file}")
                except Exception as e:
                    logger.error(f"❌ FAILED to save raw log: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # Parse results and save to database
                # Initialize with defaults (in case parsing fails)
                profit_pct = 0.0
                profit_abs = 0.0
                total_trades = 0
                win_rate = 0.0
                max_drawdown = 0.0
                sharpe = 0.0
                sortino = 0.0
                profit_factor = 0.0
                avg_profit = 0.0
                export_data = {}
                db_inserted = False
                
                try:
                    stdout = result.stdout if result.stdout else ""
                    
                    # Parse key metrics from stdout - handle unicode table format
                    # The format uses │ as column separators
                    
                    # Total profit % from SUMMARY METRICS table
                    profit_match = re.search(r'Total profit %\s*│\s*([-?\d.]+)%', stdout)
                    if not profit_match:
                        profit_match = re.search(r'Total profit[\s%]*[:\-]?\s*([-?\d.]+)%', stdout, re.IGNORECASE)
                    profit_pct = float(profit_match.group(1)) if profit_match else 0.0
                    
                    # Absolute profit USDT
                    abs_match = re.search(r'Absolute profit\s*│\s*([-?\d.]+)\s*USDT', stdout)
                    if not abs_match:
                        abs_match = re.search(r'Absolute profit[\s:]*([-?\d.]+)\s*USDT', stdout, re.IGNORECASE)
                    profit_abs = float(abs_match.group(1)) if abs_match else 0.0
                    
                    # Total trades - look for TOTAL row: TOTAL │ 7367 │ ...
                    trades_match = re.search(r'TOTAL\s*│\s*(\d+)', stdout)
                    if not trades_match:
                        trades_match = re.search(r'Total/Daily Avg Trades\s*[:/\-]?\s*(\d+)', stdout, re.IGNORECASE)
                    total_trades = int(trades_match.group(1)) if trades_match else 0
                    
                    # Win rate - last number in TOTAL row before │
                    # Pattern: TOTAL │ 7367 │ ... │ 6420     0   947  87.1 │
                    win_match = re.search(r'TOTAL\s*│[^│]+│[^│]+│[^│]+│[^│]+│[^│]+│\s*\d+\s+\d+\s+\d+\s+([\d.]+)', stdout)
                    if not win_match:
                        win_match = re.search(r'Win[\s%]*[:\-]?\s*([\d.]+)', stdout, re.IGNORECASE)
                    win_rate = float(win_match.group(1)) if win_match else 0.0
                    
                    # Max Drawdown
                    drawdown_match = re.search(r'Max Drawdown\s*│\s*([-?\d.]+)%', stdout)
                    if not drawdown_match:
                        drawdown_match = re.search(r'Max [Dd]rawdown[\s%]*[:\-]?\s*([\d.]+)', stdout, re.IGNORECASE)
                    max_drawdown = float(drawdown_match.group(1)) if drawdown_match else 0.0
                    
                    # Sharpe
                    sharpe_match = re.search(r'Sharpe\s*│\s*([-?\d.]+)', stdout)
                    if not sharpe_match:
                        sharpe_match = re.search(r'Sharpe[\s:]*([-?\d.]+)', stdout, re.IGNORECASE)
                    sharpe = float(sharpe_match.group(1)) if sharpe_match else 0.0
                    
                    # Sortino
                    sortino_match = re.search(r'Sortino\s*│\s*([-?\d.]+)', stdout)
                    if not sortino_match:
                        sortino_match = re.search(r'Sortino[\s:]*([-?\d.]+)', stdout, re.IGNORECASE)
                    sortino = float(sortino_match.group(1)) if sortino_match else 0.0
                    
                    # Profit factor
                    profit_factor_match = re.search(r'Profit Factor\s*│\s*([\d.]+)', stdout)
                    if not profit_factor_match:
                        profit_factor_match = re.search(r'Profit [Ff]actor[\s:]*([\d.]+)', stdout, re.IGNORECASE)
                    profit_factor = float(profit_factor_match.group(1)) if profit_factor_match else 0.0
                    
                    # Avg profit - from TOTAL row, second column
                    avg_match = re.search(r'TOTAL\s*│\s*\d+\s*│\s*([-?\d.]+)', stdout)
                    if avg_match:
                        avg_profit = float(avg_match.group(1))
                    avg_profit_match = re.search(r'Avg profit[:\s]+([-?\d.]+)%', result.stdout, re.IGNORECASE)
                    avg_profit = float(avg_profit_match.group(1)) if avg_profit_match else 0.0
                    
                    logger.info(f"Parsed: profit={profit_pct}%, abs={profit_abs} USDT, trades={total_trades}, win={win_rate}%, dd={max_drawdown}%, sharpe={sharpe}")
                    
                    # Try to read the export file for more details
                    if os.path.exists(host_export_path):
                        try:
                            with open(host_export_path, 'r') as f:
                                export_data = json.load(f)
                                logger.info(f"Loaded export file: {host_export_path}")
                        except Exception as e:
                            logger.warning(f"Could not read export file: {e}")
                    
                    # Insert into backtest_results table using SQLAlchemy (async)
                    try:
                        import psycopg2
                        from src.config import settings
                        
                        # FIX: Use settings.database.url not settings.DATABASE_URL
                        db_url = settings.database.url.replace('postgresql+asyncpg://', 'postgresql://')
                        conn = psycopg2.connect(db_url)
                        cur = conn.cursor()
                        cur.execute("""
                            INSERT INTO backtest_results (
                                strategy_name, timeframe, timerange,
                                profit_pct, profit_abs, avg_profit_pct,
                                profit_factor, max_drawdown_pct,
                                sharpe_ratio, sortino_ratio, total_trades, winrate_pct,
                                export_file, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                        """, (
                            strategy_name, "15m", "20241001-20260224",
                            profit_pct, profit_abs, avg_profit,
                            profit_factor, max_drawdown,
                            sharpe, sortino, total_trades, win_rate,
                            host_export_path,
                        ))
                        conn.commit()
                        cur.close()
                        conn.close()
                        db_inserted = True
                        logger.info(f"✅ INSERTED backtest result into database for {strategy_name}")
                    except ImportError:
                        logger.warning("psycopg2 not available - results saved to file only, will be picked up by scanner")
                    except Exception as e:
                        logger.error(f"❌ DB insert failed: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                    
                except Exception as e:
                    logger.error(f"❌ Parsing failed: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                # ALWAYS save result summary JSON (even if parsing failed)
                try:
                    result_data = {
                        'strategy': strategy_name,
                        'type': 'backtest',
                        'status': 'completed' if result.returncode == 0 else 'error',
                        'timestamp': datetime.now().isoformat(),
                        'profit_pct': profit_pct,
                        'profit_abs': profit_abs,
                        'total_trades': total_trades,
                        'win_rate': win_rate,
                        'max_drawdown': max_drawdown,
                        'avg_profit_pct': avg_profit,
                        'sharpe': sharpe,
                        'sortino': sortino,
                        'profit_factor': profit_factor,
                        'export_file': host_export_path,
                        'parsed': True,
                        'db_inserted': db_inserted
                    }
                    
                    result_file = f"{results_dir}/{strategy_name}_{timestamp}.json"
                    logger.info(f"Attempting to save JSON to: {result_file}")
                    with open(result_file, 'w') as f:
                        json.dump(result_data, f, indent=2)
                    logger.info(f"✅ Saved backtest result to {result_file}")
                except Exception as e:
                    logger.error(f"❌ FAILED to save JSON: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                
                logger.info(f"Backtest stdout: {result.stdout[:2000]}")
                logger.error(f"Backtest stderr: {result.stderr[:2000]}")
                logger.info(f"Backtest return code: {result.returncode}")
                if result.returncode != 0:
                    logger.error(f"Backtest FAILED for {strategy_name}")
                else:
                    logger.info(f"Backtest completed for {strategy_name}")
                    
                    # AUTO-IMPORT: Use raw log importer
                    try:
                        logger.info(f"Auto-importing backtest results for {strategy_name}")
                        result = await async_subprocess_run(
                            ['python3', '/opt/Multibotdashboard/scripts/import-meta-backtests.py'],
                            capture_output=True,
                            text=True,
                            timeout=60
                        )
                        logger.info(f"Auto-import output: {result.stdout[:500]}")
                        if result.stderr:
                            logger.error(f"Auto-import stderr: {result.stderr[:500]}")
                    except Exception as e:
                        logger.error(f"Auto-import failed: {e}")
            
            if 'hyperopt' in steps:
                logger.info(f"Running hyperopt for {strategy_name}, epochs={epochs}")
                results_dir2 = "/opt/Multibotdashboard/results/hyperopt"
                os.makedirs(results_dir2, exist_ok=True)
                timestamp = int(time.time())
                
                # Read strategy content
                try:
                    with open(dest_path, 'r') as f:
                        strategy_content = f.read()
                except Exception as e:
                    logger.warning(f"Could not read strategy: {e}")
                    strategy_content = ""
                
                # RESET and detect available hyperopt spaces
                available_spaces = ["buy"]  # RESET here, not append!
                
                try:
                    content_lower = strategy_content.lower()
                    if "sell" in content_lower and "parameter" in content_lower:
                        available_spaces.append("sell")
                    if "protection" in content_lower and "parameter" in content_lower:
                        available_spaces.append("protection")
                    if "stoploss" in content_lower and "parameter" in content_lower:
                        available_spaces.append("stoploss")
                    if "roi" in content_lower and "parameter" in content_lower:
                        available_spaces.append("roi")
                    if "trailing" in content_lower and "parameter" in content_lower:
                        available_spaces.append("trailing")
                except Exception as e:
                    logger.warning(f"Space detection error: {e}")
                
                logger.info(f"Hyperopt spaces: {available_spaces}")

                cmd = [
                    "docker", "run",
                    "--name", f"hyperopt_{strategy_name}_{timestamp}",
                    "-v", f"{freqtrade_strat_dir}:/freqtrade/user_data/strategies",
                    "-v", "/opt/Freqtrade_data/data:/freqtrade/user_data/data",
                    "-v", "/opt/Freqtrade/user_data/config:/freqtrade/config",
                    "-v", f"{results_dir2}:/freqtrade/user_data/hyperopt_results",
                    "-v", "/opt/Freqtrade/user_data/logs:/freqtrade/user_data/logs",
                    "freqtradeorg/freqtrade:stable_freqaitorch",
                    "hyperopt",
                    "--strategy", strategy_class,
                    "--config", "/freqtrade/config/config-torch.json",
                    "--timerange", "20251001-20260221",
                    "--timeframe", "15m",
                    "--epochs", str(epochs),
                    "--spaces", "all",
                    "--hyperopt-loss", "SharpeHyperOptLoss",
                    "-j", "4"
                ]
                logger.info(f"Docker command: {' '.join(cmd)}")
                result = await async_subprocess_run(cmd, capture_output=True, text=True, timeout=7200)
                
                # ALWAYS save raw results (like backtest)
                try:
                    raw_log_file = f"{results_dir2}/{strategy_name}_{timestamp}_raw.log"
                    logger.info(f"Attempting to save hyperopt raw log to: {raw_log_file}")
                    with open(raw_log_file, 'w') as f:
                        f.write("=== STDOUT ===\n")
                        f.write(result.stdout if result.stdout else "")
                        f.write("\n=== STDERR ===\n")
                        f.write(result.stderr if result.stderr else "")
                        f.write(f"\n=== RETURN CODE ===\n{result.returncode}")
                    logger.info(f"✅ Saved hyperopt raw log to {raw_log_file}")
                except Exception as e:
                    logger.error(f"❌ Failed to save hyperopt raw log: {e}")
                
                # Parse hyperopt results from stdout (like backtest)
                best_epoch = None
                try:
                    stdout = result.stdout if result.stdout else ""
                    
                    # Look for "Best result:" or "Best epoch:" in stdout
                    # Pattern: Best result: Epoch 42 - Profit 15.2%
                    best_match = re.search(r'Best\s+(?:result|epoch):?\s*Epoch\s*(\d+)', stdout, re.IGNORECASE)
                    if best_match:
                        epoch_num = int(best_match.group(1))
                        logger.info(f"Found best epoch from stdout: {epoch_num}")
                        
                        # Try to parse epoch details from table
                        # Look for epoch row in results table
                        epoch_pattern = rf'{epoch_num}\s*│\s*([\d.]+)\s*│\s*([\d.]+)\s*│\s*([\d.]+)\s*│\s*(\d+)'
                        epoch_match = re.search(epoch_pattern, stdout)
                        if epoch_match:
                            best_epoch = {
                                'epoch': epoch_num,
                                'profit_mean_pct': float(epoch_match.group(1)),
                                'profit_total_pct': float(epoch_match.group(2)),
                                'winrate': float(epoch_match.group(3)) / 100,  # Convert to decimal
                                'trade_count': int(epoch_match.group(4))
                            }
                            logger.info(f"Parsed epoch {epoch_num} details from stdout")
                    
                    # Also look for sharpe/sortino in summary
                    sharpe_match = re.search(r'Sharpe\s*[:\-]?\s*([-?\d.]+)', stdout, re.IGNORECASE)
                    if sharpe_match and best_epoch:
                        best_epoch['sharpe'] = float(sharpe_match.group(1))
                    
                    sortino_match = re.search(r'Sortino\s*[:\-]?\s*([-?\d.]+)', stdout, re.IGNORECASE)
                    if sortino_match and best_epoch:
                        best_epoch['sortino'] = float(sortino_match.group(1))
                        
                except Exception as e:
                    logger.error(f"Could not parse hyperopt stdout: {e}")
                    
                # Fallback: try fthypt file
                if not best_epoch:
                    try:
                        import glob
                        fthypt_files = glob.glob(f"{results_dir2}/.fthypt*{strategy_name}*")
                        if fthypt_files:
                            latest_file = max(fthypt_files, key=os.path.getmtime)
                            logger.info(f"Found fthypt file: {latest_file}")
                            with open(latest_file, 'r') as f:
                                lines = f.readlines()
                                for line in reversed(lines):
                                    if '"epoch"' in line:
                                        try:
                                            epoch_data = json.loads(line)
                                            if epoch_data.get('is_best'):
                                                best_epoch = epoch_data
                                                logger.info(f"Found best epoch from fthypt: {epoch_data.get('epoch')}")
                                                break
                                        except:
                                            pass
                    except Exception as e2:
                        logger.error(f"Could not parse fthypt: {e2}")
                
                # Save results to JSON file in Multibotdashboard
                try:
                    import json
                    from datetime import datetime
                    
                    result_data = {
                        'strategy': strategy_name,
                        'type': 'hyperopt',
                        'status': 'completed' if result.returncode == 0 else 'error',
                        'timestamp': datetime.now().isoformat(),
                        'epochs': epochs,
                        'profit_pct': best_epoch.get('profit_total_pct') if best_epoch else None,
                        'drawdown': best_epoch.get('max_drawdown') if best_epoch else None,
                        'best_epoch': best_epoch,
                        'export_file': host_export_path,  # ADD EXPORT FILE PATH
                        'stdout': result.stdout[-5000:] if result.stdout else None,
                        'stderr': result.stderr[-2000:] if result.stderr else None
                    }
                    
                    # Save to Multibotdashboard results folder
                    # Use SAME timestamp as above
                    result_file = f"{results_dir2}/{strategy_name}_{timestamp}.json"
                    logger.info(f"Attempting to save hyperopt JSON to: {result_file}")
                    with open(result_file, 'w') as f:
                        json.dump(result_data, f, indent=2)
                    logger.info(f"✅ Saved hyperopt result to {result_file}")
                    
                    # INSERT INTO DATABASE
                    if best_epoch:
                        try:
                            import psycopg2
                            from src.config import settings
                            
                            db_url = settings.database.url.replace('postgresql+asyncpg://', 'postgresql://')
                            conn = psycopg2.connect(db_url)
                            cur = conn.cursor()
                            
                            cur.execute("""
                                INSERT INTO hyperopt_epochs (
                                    strategy_name, epoch, profit_pct, winrate_pct, 
                                    avg_profit_pct, total_trades, sharpe_ratio, sortino_ratio,
                                    params, is_best, created_at
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            """, (
                                strategy_name,
                                best_epoch.get('epoch', 0),
                                best_epoch.get('profit_total_pct', 0),
                                (best_epoch.get('winrate') or 0) * 100,
                                best_epoch.get('profit_mean_pct', 0),
                                best_epoch.get('trade_count', 0),
                                best_epoch.get('sharpe', 0),
                                best_epoch.get('sortino', 0),
                                json.dumps(best_epoch.get('params', {})),
                                True
                            ))
                            conn.commit()
                            cur.close()
                            conn.close()
                            logger.info(f"✅ INSERTED hyperopt result into database for {strategy_name}")
                        except Exception as e:
                            logger.error(f"❌ Hyperopt DB insert failed: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                    
                    # AUTO-IMPORT: Also run import script (for consistency)
                    try:
                        logger.info(f"Auto-importing hyperopt results for {strategy_name}")
                        result_import = await async_subprocess_run(
                            ['python3', '/opt/Multibotdashboard/scripts/import-hyperopt.py'],
                            capture_output=True,
                            text=True,
                            timeout=60
                        )
                        logger.info(f"Hyperopt auto-import output: {result_import.stdout[:500]}")
                        if result_import.stderr:
                            logger.error(f"Hyperopt auto-import stderr: {result_import.stderr[:500]}")
                    except Exception as e:
                        logger.error(f"Hyperopt auto-import failed: {e}")
                except Exception as e:
                    logger.error(f"Failed to save hyperopt result: {e}")
                
                logger.info(f"Hyperopt stdout: {result.stdout[:2000]}")
                logger.error(f"Hyperopt stderr: {result.stderr[:2000]}")
                logger.info(f"Hyperopt return code: {result.returncode}")
                if result.returncode != 0:
                    logger.error(f"Hyperopt FAILED for {strategy_name}")
                else:
                    logger.info(f"Hyperopt completed for {strategy_name}")
                
        except Exception as e:
            logger.error(f"Workflow error: {e}")
        finally:
            # Cleanup copied strategy file
            try:
                copied_file = os.path.join(freqtrade_strat_dir, f"{strategy_name}.py")
                if os.path.exists(copied_file):
                    os.remove(copied_file)
                    logger.info(f"Cleaned up strategy file: {copied_file}")
            except Exception as e:
                logger.warning(f"Could not cleanup strategy file: {e}")
    
    # Start background task (non-blocking)
    asyncio.create_task(run_workflow())
    
    return {
        "status": "started",
        "strategy": strategy_name,
        "bot_id": bot_id,
        "bot_name": bot_name,
        "steps": steps,
        "message": f"Workflow started: {', '.join(steps)}"
    }


@router.post("/bots/{bot_id}/workflow/stop")
async def stop_workflow(
    bot_id: str,
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Stop running workflow for a bot"""
    if not app_state:
        raise HTTPException(status_code=503, detail="Strategy Lab not initialized")
    
    # Get bot to find its strategy name
    result = await session.get(Bot, bot_id)
    if not result:
        return {"status": "idle", "message": "Bot not found"}
    
    bot = result
    strategy_name = bot.strategy or bot.name
    
    process = app_state.get_process(ProcessType.HYPEROPT, strategy_name)
    if not process:
        process = app_state.get_process(ProcessType.BACKTEST, strategy_name)
    
    if not process:
        return {"status": "idle", "message": "No workflow to stop"}
    
    # Stop the process
    await workflow_engine.stop_process(strategy_name)
    
    return {
        "status": "stopped",
        "bot_id": bot_id,
        "message": "Workflow stopped"
    }


@router.post("/import-backtest-results")
async def import_backtest_results(
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Import backtest results from JSON files into database"""
    imported = 0
    errors = []
    
    results_dir = "/opt/Multibotdashboard/results/backtest"
    if not os.path.exists(results_dir):
        return {"status": "error", "message": "Results directory not found"}
    
    for filename in os.listdir(results_dir):
        if not filename.endswith('.json') or filename.endswith('_export.json'):
            continue  # Skip export files and non-JSON
            
        filepath = os.path.join(results_dir, filename)
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            # Skip if already has 'db_imported' flag
            if data.get('db_imported'):
                continue
                
            strategy = data.get('strategy') or data.get('strategy_name')
            if not strategy:
                continue
                
            # Check if already in database
            result = await session.execute(
                text("""
                    SELECT id FROM backtest_results 
                    WHERE strategy_name = :strategy 
                    AND created_at > NOW() - INTERVAL '1 hour'
                """),
                {"strategy": strategy}
            )
            if result.fetchone():
                continue  # Already imported recently
            
            # Insert into database
            await session.execute(
                text("""
                    INSERT INTO backtest_results (
                        strategy_name, timeframe, timerange,
                        profit_pct, profit_abs, total_trades,
                        winrate_pct, max_drawdown_pct, sharpe_ratio, avg_profit_pct,
                        created_at
                    ) VALUES (
                        :strategy_name, :timeframe, :timerange,
                        :profit_pct, :profit_abs, :total_trades,
                        :winrate_pct, :max_drawdown, :sharpe_ratio, :avg_profit_pct,
                        NOW()
                    )
                """),
                {
                    "strategy_name": strategy,
                    "timeframe": data.get('timeframe', '15m'),
                    "timerange": data.get('timerange', '20241001-20260224'),
                    "profit_pct": data.get('profit_pct', 0) or 0,
                    "profit_abs": data.get('profit_abs', 0) or 0,
                    "total_trades": data.get('total_trades', 0) or 0,
                    "winrate_pct": data.get('winrate_pct', 0) or 0,
                    "max_drawdown": data.get('max_drawdown', 0) or 0,
                    "sharpe_ratio": data.get('sharpe_ratio', 0) or 0,
                    "avg_profit_pct": data.get('avg_profit_pct', 0) or 0
                }
            )
            await session.commit()
            
            # Mark as imported
            data['db_imported'] = True
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
            
            imported += 1
            logger.info(f"Imported {filename} to database")
            
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")
            logger.error(f"Failed to import {filename}: {e}")
    
    return {
        "status": "success",
        "imported": imported,
        "errors": errors
    }


@router.post("/hyperopt/{strategy_name}/extract/{epoch_number}")
async def extract_epoch_params(
    strategy_name: str,
    epoch_number: int,
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Extract parameters from a specific epoch"""
    if not workflow_engine:
        raise HTTPException(status_code=503, detail="Strategy Lab not initialized")
    
    # Run hyperopt-show command
    success = await workflow_engine.extract_epoch(strategy_name, epoch_number)
    
    if success:
        return {
            "status": "success",
            "strategy": strategy_name,
            "epoch": epoch_number,
            "message": f"Parameters extracted and saved"
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to extract parameters")


@router.get("/optimization-results")
async def get_optimization_results(
    limit: int = 50,
    session: AsyncSession = Depends(get_db)
) -> List[dict]:
    """Get optimization results from BOTH optimization_runs AND backtest_results tables"""
    results = []
    
    # FIRST: Get from optimization_runs table (primary for workflow runs)
    try:
        opt_results = await session.execute(
            text("""
                SELECT 
                    id, bot_id, strategy_name, run_type, status,
                    started_at, completed_at, duration_seconds,
                    profit_pct, max_drawdown_pct, total_trades,
                    config, error_message
                FROM optimization_runs
                ORDER BY COALESCE(started_at, created_at) DESC
                LIMIT :limit
            """),
            {"limit": limit}
        )
        
        for row in opt_results.fetchall():
            results.append({
                "id": f"opt_{row[0]}",
                "bot_id": str(row[1]) if row[1] else None,
                "strategy_name": row[2],
                "process_type": row[3],
                "type": row[3],
                "status": row[4],
                "started_at": row[5].isoformat() if row[5] else None,
                "completed_at": row[6].isoformat() if row[6] else None,
                "duration_seconds": row[7],
                "result_profit_pct": float(row[8]) if row[8] is not None else None,
                "result_drawdown": float(row[9]) if row[9] is not None else None,
                "result_trade_count": row[10],
                "config": row[11],
                "error_message": row[12],
            })
    except Exception as e:
        logger.warning(f"optimization_runs query failed: {e}")
    
    # SECOND: Also get from backtest_results table (for backtests run via workflow)
    # Only add if we have fewer than limit results
    if len(results) < limit:
        remaining = limit - len(results)
        try:
            db_results = await session.execute(
                text("""
                    SELECT 
                        id, strategy_name, timeframe, timerange,
                        profit_pct, profit_abs, total_trades,
                        winrate_pct, avg_profit_pct, max_drawdown_pct, sharpe_ratio,
                        created_at
                    FROM backtest_results
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {"limit": remaining}
            )
            
            for row in db_results.fetchall():
                created_at = row[11]
                
                results.append({
                    "id": f"backtest_{row[0]}",
                    "strategy_name": row[1],
                    "process_type": "backtest",
                    "type": "backtest",
                    "status": "completed",
                    "started_at": created_at.isoformat() if created_at else None,
                    "completed_at": created_at.isoformat() if created_at else None,
                    "result_profit_pct": float(row[4]) if row[4] is not None else None,
                    "result_drawdown": float(row[9]) if row[9] is not None else None,
                    "result_trade_count": row[6],
                    "win_rate": float(row[7]) if row[7] is not None else None,
                    "sharpe": float(row[10]) if row[10] is not None else None,
                    "timeframe": row[2],
                    "timerange": row[3],
                })
        except Exception as e:
            logger.warning(f"backtest_results query failed: {e}")
    
    # Sort by started_at (newest first)
    results.sort(key=lambda x: x.get('started_at') or '', reverse=True)
    
    return results[:limit]


@router.post("/optimization-results/import")
async def import_results_to_db(
    session: AsyncSession = Depends(get_db)
) -> dict:
    """Import all JSON results into database"""
    imported = 0
    
    # Import backtest results
    backtest_dir = "/opt/Multibotdashboard/results/backtest"
    if os.path.exists(backtest_dir):
        for filename in os.listdir(backtest_dir):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(backtest_dir, filename), 'r') as f:
                        data = json.load(f)
                        # TODO: Insert into optimization_runs table
                        imported += 1
                except Exception as e:
                    logger.warning(f"Could not import {filename}: {e}")
    
    # Import hyperopt results
    hyperopt_dir = "/opt/Multibotdashboard/results/hyperopt"
    if os.path.exists(hyperopt_dir):
        for filename in os.listdir(hyperopt_dir):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(hyperopt_dir, filename), 'r') as f:
                        data = json.load(f)
                        # TODO: Insert into optimization_runs table
                        imported += 1
                except Exception as e:
                    logger.warning(f"Could not import {filename}: {e}")
    
    return {"status": "success", "imported": imported}


# =====================================================================
# Strategy recommendations — scoring of backtest/hyperopt candidates
# (методология оценки: доходность 40%, риск 30%, стабильность 20%, эффективность 10%)
# =====================================================================

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _linear_score(value: float | None, good: float, bad: float) -> float:
    """Map value to 0..10: >=good → 10, <=bad → 0, linear between."""
    if value is None:
        return 0.0
    if good == bad:
        return 10.0 if value >= good else 0.0
    return _clamp((value - bad) / (good - bad) * 10.0, 0.0, 10.0)


def _score_candidate(r: dict) -> dict:
    profit = r.get("profit_pct")
    dd = r.get("max_drawdown_pct")
    sharpe = r.get("sharpe_ratio")
    winrate = r.get("winrate_pct")
    pf = r.get("profit_factor")
    trades = r.get("total_trades")

    s_profit = _linear_score(profit, good=30.0, bad=-30.0)
    s_dd = _linear_score(-(dd or 0.0), good=-10.0, bad=-50.0)
    s_sharpe = _linear_score(sharpe, good=2.5, bad=0.0)
    s_winrate = _linear_score(winrate, good=60.0, bad=30.0)
    s_pf = _linear_score(pf, good=2.0, bad=1.0)
    s_trades = _linear_score(trades, good=150.0, bad=10.0)

    score = (
        s_profit * 0.40
        + (s_dd * 0.6 + s_sharpe * 0.4) * 0.30
        + (s_winrate * 0.5 + s_pf * 0.5) * 0.20
        + s_trades * 0.10
    )
    score = round(_clamp(score, 0.0, 10.0), 2)

    reasons: list[str] = []
    if profit is not None and profit >= 15:
        reasons.append(f"Доходность {profit:+.1f}%")
    if dd is not None and dd > 30:
        reasons.append(f"Просадка {dd:.1f}% — выше допустимой")
    if sharpe is not None and sharpe >= 1.5:
        reasons.append(f"Sharpe {sharpe:.2f}")
    if pf is not None and pf < 1.0:
        reasons.append("Фактор прибыли < 1.0")
    if trades is not None and trades < 30:
        reasons.append("Мало сделок — низкая статистика")

    if dd is not None and dd > 35:
        recommendation = "no"
    elif score >= 7.0:
        recommendation = "go"
    elif score >= 5.0:
        recommendation = "watch"
    else:
        recommendation = "no"

    return {
        **r,
        "score": score,
        "percent": round(score * 10.0, 1),
        "recommendation": recommendation,
        "reasons": reasons,
    }


@router.get("/recommendations")
async def get_recommendations(
    session: AsyncSession = Depends(get_db),
    _: object = Depends(require_operator),
) -> dict:
    """Rank strategy candidates from backtests + hyperopt runs.

    Returns the latest result per strategy (backtest if present, else hyperopt run),
    scored 0-10 with a recommendation: go / watch / no.
    """
    # Latest backtest per strategy
    backtest_rows = (
        await session.execute(
            text(
                """
                SELECT DISTINCT ON (strategy_name)
                    strategy_name,
                    timeframe,
                    timerange,
                    profit_pct,
                    winrate_pct,
                    max_drawdown_pct,
                    profit_factor,
                    sharpe_ratio,
                    total_trades,
                    created_at
                FROM backtest_results
                WHERE strategy_name IS NOT NULL
                ORDER BY strategy_name, created_at DESC
                """
            )
        )
    ).mappings().all()

    # Latest completed optimization run per strategy (hyperopt / backtest via workflow)
    run_rows = (
        await session.execute(
            text(
                """
                SELECT DISTINCT ON (strategy_name)
                    strategy_name,
                    run_type AS process_type,
                    profit_pct,
                    max_drawdown_pct,
                    winrate_pct,
                    profit_pct AS result_profit_pct,
                    max_drawdown_pct AS result_drawdown,
                    created_at
                FROM optimization_runs
                WHERE status = 'completed' AND strategy_name IS NOT NULL
                ORDER BY strategy_name, created_at DESC
                """
            )
        )
    ).mappings().all()

    merged: dict[str, dict] = {}
    for row in backtest_rows:
        merged[row["strategy_name"]] = dict(row)
    for row in run_rows:
        name = row["strategy_name"]
        if name not in merged or (
            row.get("created_at") and merged[name].get("created_at") and row["created_at"] > merged[name]["created_at"]
        ):
            merged[name] = dict(row)

    candidates = [_score_candidate(r) for r in merged.values()]
    candidates.sort(key=lambda c: c["score"], reverse=True)

    return {
        "status": "success",
        "data": candidates,
    }


# =====================================================================
# AI strategy generator — конструктор стратегий через ИИ-агента
# =====================================================================

_AI_SYSTEM_PROMPT = """Ты — экспертный разработчик торговых стратегий для Freqtrade.
Напиши полный Python-файл стратегии, совместимый с Freqtrade (класс наследует IStrategy).
Жёсткие требования:
1. Файл начинается с `from freqtrade.strategy import IStrategy` и импорта pandas_ta (или ta-lib, если он нужен) и numpy при необходимости.
2. Один класс `class <Name>(IStrategy)` с атрибутами: timeframe, minimal_roi, stoploss, trailing_stop, process_only_new_candles, use_exit_signal, can_short (если уместно).
3. Метод `populate_indicators(self, dataframe, metadata)` — расчёт индикаторов.
4. Метод `populate_entry_trend(self, dataframe, metadata)` — условия входа, возвращает dataframe с колонкой 'enter_long' (и 'enter_short' если can_short).
5. Метод `populate_exit_trend(self, dataframe, metadata)` — условия выхода, колонка 'exit_long'.
6. Не используй внешние данные и файлы. Только индикаторы pandas_ta: ema, sma, rsi, macd, bollinger, atr, adx, stoch, cci, vwap и т.п.
7. Код должен быть самодостаточным, без синтаксических ошибок, без комментариев-заглушек «TODO».
8. Логика — понятная и обоснованная: фильтры тренда + фильтры волатильности/объёма, защита от ложных сигналов.
9. Используй параметры с разумными значениями по умолчанию (можно через class-атрибуты BUY_PARAMS/SELL_PARAMS для гиперопта, но не обязательно).
10. Имя класса — только латинские буквы, цифры и подчёркивание (без кириллицы и пробелов).
11. Верни ТОЛЬКО код Python без markdown-разметки, без пояснений."""


_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def _transliterate(text: str) -> str:
    return "".join(_TRANSLIT.get(ch, ch) for ch in text.lower())


def _class_name_from_description(description: str) -> str:
    words = re.findall(r"[A-Za-zА-Яа-я0-9]+", description)
    meaningful = [w for w in words if w.lower() not in {"и", "с", "в", "на", "для", "по", "сделай", "создай", "стратегию", "стратегия", "бот", "бота", "напиши", "нужна", "хочу", "простая", "новую"} and len(w) > 1]
    if not meaningful:
        return "AIGeneratedStrategy"
    base = "".join(_transliterate(w).capitalize() for w in meaningful[:3])
    base = re.sub(r"[^A-Za-z0-9_]", "", base)
    if not base:
        return "AIGeneratedStrategy"
    return base[:40] or "AIGeneratedStrategy"


def _sanitize_ai_name(raw: str) -> str:
    name = re.sub(r"[^A-Za-z0-9_]", "", raw or "")
    if not name:
        return "AIGeneratedStrategy"
    if name[0].isdigit():
        name = "S" + name
    return name[:40]


async def _call_openai(prompt: str, system: str, max_tokens: int = 4000) -> str:
    import httpx

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY не настроен на сервере",
        )
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-nano")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"AI-сервис ответил {resp.status_code}: {resp.text[:300]}",
        )
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="AI-сервис вернул пустой ответ")


def _extract_python_code(text: str) -> str:
    """Strip markdown fences if the model wrapped the code."""
    m = re.search(r"```(?:python)?\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text.strip()


def _validate_strategy_code(code: str, class_name: str) -> tuple[str, Optional[str]]:
    """Validate syntax + IStrategy class. Returns (class_name, error|None)."""
    import ast

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Сгенерированный код содержит ошибку синтаксиса: {e}",
        )
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            bases = [getattr(b, "id", "") for b in node.bases]
            if "IStrategy" in bases:
                return node.name, None
    # fallback: class name match
    if class_name:
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                return node.name, None
    raise HTTPException(
        status_code=422,
        detail="Сгенерированный код не содержит класс, наследующий IStrategy",
    )


@router.post("/ai/generate")
async def ai_generate_strategy(
    request: dict,
    _: object = Depends(require_operator),
) -> dict:
    """Generate a new strategy file via AI agent (OpenAI chat completions).

    Body: {"description": "...", "name": "optional"}
    """
    description = (request.get("description") or "").strip()
    if len(description) < 10:
        raise HTTPException(status_code=422, detail="Опишите идею стратегии подробнее (минимум 10 символов)")

    raw_name = (request.get("name") or "").strip()
    class_name = _sanitize_ai_name(raw_name) if raw_name else _class_name_from_description(description)

    prompt = (
        "Создай торговую стратегию для Freqtrade по следующему описанию:\n\n"
        f"{description}\n\n"
        f"Название класса стратегии: {class_name}\n"
        "Класс должен называться именно так, как указано."
    )

    code = await _call_openai(prompt, _AI_SYSTEM_PROMPT)
    code = _extract_python_code(code)
    actual_class, _ = _validate_strategy_code(code, class_name)

    strategies_root = _get_strategies_root()
    dest_dir = os.path.join(strategies_root, "AI")
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, f"{actual_class}.py")

    if os.path.exists(dest_path):
        raise HTTPException(
            status_code=409,
            detail=f"Стратегия {actual_class} уже существует. Переименуйте или удалите её.",
        )

    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(code)
        if not code.endswith("\n"):
            f.write("\n")

    logger.info(f"AI-generated strategy saved: {dest_path}")

    return {
        "status": "success",
        "data": {
            "strategy_name": actual_class,
            "class_name": actual_class,
            "family": "AI",
            "path": dest_path,
            "preview": code[:3000],
        },
    }


# WebSocket for real-time updates
@router.websocket("/ws")
async def strategy_lab_websocket(websocket: WebSocket):
    """WebSocket for real-time workflow and hyperopt updates"""
    await websocket.accept()
    
    if not app_state:
        await websocket.close(code=1011, reason="Strategy Lab not initialized")
        return
    
    # Subscribe to state updates
    async def state_callback(update: dict):
        await websocket.send_json({
            "type": "state_update",
            "data": update
        })
    
    app_state.subscribe(state_callback)
    
    try:
        while True:
            # Keep connection alive, handle client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        app_state.unsubscribe(state_callback)
