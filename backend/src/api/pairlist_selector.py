"""
Pairlist Selector API - Run pairlist optimization jobs via Docker
"""

import asyncio
import json
import os
import logging
import subprocess
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, PairlistJob, PairlistResult, PairlistPairResult, async_session_maker
from src.api.deps import get_current_active_user

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_active_user)])

# Track running jobs
running_jobs: Dict[str, Dict[str, Any]] = {}


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


class PairlistRequest(BaseModel):
    strategy: str
    mode: str = "fullbacktest_batch"  # ml_training, fullbacktest_batch, fullbacktest_individual
    n_pairs: int = 50
    download_days: int = 60
    backtest_days: Optional[int] = None
    config_file: str = "config-pairlist.json"
    max_pairs: int = 500

class PairlistResponse(BaseModel):
    job_id: str
    status: str
    message: str

class PairlistStatus(BaseModel):
    job_id: str
    status: str  # running, completed, failed
    strategy: str
    progress: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None

@router.post("/pairlist-selector/run", response_model=PairlistResponse)
async def run_pairlist_selector(
    request: PairlistRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db)
) -> PairlistResponse:
    """Start a pairlist selector job in Docker"""
    
    job_id = f"pairlist_{request.strategy}_{int(time.time())}"
    timestamp = int(time.time())
    
    # Create results directory
    results_dir = "/opt/Multibotdashboard/results/pairlists"
    os.makedirs(results_dir, exist_ok=True)
    
    # Build command based on mode
    cmd = [
        "docker", "run",
        "--name", job_id,
        "--entrypoint", "python",
        "-v", "/opt/Freqtrade/user_data/strategies:/freqtrade/user_data/strategies",
        "-v", "/opt/Freqtrade_data/data:/freqtrade/user_data/data",
        "-v", "/opt/Freqtrade/user_data/config:/freqtrade/config",
        "-v", f"{results_dir}:/freqtrade/user_data/pairlist_results",
        "-v", "/opt/Freqtrade/user_data/logs:/freqtrade/user_data/logs",
        "freqtradeorg/freqtrade:stable_freqaitorch",
        "/freqtrade/user_data/strategies/Alex_Pairlist_SelectorV6.py",
        "--config", f"/freqtrade/config/{request.config_file}",
        "--strategy", request.strategy,
        "--n-pairs", str(request.n_pairs),
        "--download-days", str(request.download_days),
        "--max-backtest-pairs", str(request.max_pairs),
        "--output", f"/freqtrade/user_data/pairlist_results/{request.strategy}_optimal_pairs_{job_id}.json"
    ]
    
    # Add mode-specific flags
    if request.mode == "ml_training":
        # Default mode, no extra flags
        pass
    elif request.mode == "fullbacktest_batch":
        cmd.append("--fullbacktest")
    elif request.mode == "fullbacktest_individual":
        cmd.append("--fullbacktest")
        cmd.append("--individual")
    
    # Add backtest days if specified
    if request.backtest_days:
        cmd.extend(["--backtest-days", str(request.backtest_days)])
    
    # Store job info
    running_jobs[job_id] = {
        "job_id": job_id,
        "strategy": request.strategy,
        "mode": request.mode,
        "status": "starting",
        "created_at": datetime.now().isoformat(),
        "cmd": " ".join(cmd),
        "output_file": f"{results_dir}/{request.strategy}_optimal_pairs_{job_id}.json"
    }
    
    # Start job in background
    background_tasks.add_task(_run_pairlist_job, job_id, cmd)
    
    return PairlistResponse(
        job_id=job_id,
        status="running",
        message=f"Pairlist selector started for {request.strategy}"
    )

async def _run_pairlist_job(job_id: str, cmd: List[str]):
    """Run the pairlist selector job and track progress"""
    
    job_info = running_jobs[job_id]
    job_info["status"] = "running"
    
    async with async_session_maker() as session:
        try:
            # Copy strategy file and pairlist selector to Freqtrade folder before starting
            import shutil
            strategy_name = job_info["strategy"]
            
            # Find the strategy file
            strategies_path = _get_strategies_root()
            dest_path = f"/opt/Freqtrade/user_data/strategies/{strategy_name}.py"
            
            found = False
            for root, dirs, files in os.walk(strategies_path):
                if f"{strategy_name}.py" in files:
                    src_file = os.path.join(root, f"{strategy_name}.py")
                    shutil.copy2(src_file, dest_path)
                    logger.info(f"Copied {strategy_name}.py to {dest_path}")
                    found = True
                    break
            
            if not found:
                logger.warning(f"Strategy file {strategy_name}.py not found in {strategies_path}")
            
            # Copy pairlist selector script
            pairlist_src = os.path.join(strategies_path, "Alex_Pairlist_SelectorV6.py")
            pairlist_dest = "/opt/Freqtrade/user_data/strategies/Alex_Pairlist_SelectorV6.py"
            if os.path.exists(pairlist_src):
                shutil.copy2(pairlist_src, pairlist_dest)
                logger.info(f"Copied Alex_Pairlist_SelectorV6.py to {pairlist_dest}")
            else:
                logger.warning(f"Alex_Pairlist_SelectorV6.py not found at {pairlist_src}")
            
            logger.info(f"Starting pairlist job {job_id}: {' '.join(cmd)}")
            
            # Create database entry
            db_job = PairlistJob(
                job_id=job_id,
                strategy=job_info["strategy"],
                mode=job_info["mode"],
                status="running",
                created_at=datetime.now()
            )
            session.add(db_job)
            await session.commit()
            
            # Run Docker command
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Stream output (don't accumulate — avoid memory leak)
            for line in process.stdout:
                line = line.strip()
                job_info["progress"] = line[:200]  # Last line as progress
                logger.info(f"[{job_id}] {line}")
            
            # Wait for completion
            return_code = process.wait()
            stderr = process.stderr.read()
            
            if return_code != 0:
                job_info["status"] = "failed"
                job_info["error"] = stderr[:500]
                db_job.status = "failed"
                db_job.error_message = stderr[:1000]
                logger.error(f"Pairlist job {job_id} failed: {stderr}")
            else:
                job_info["status"] = "completed"
                job_info["completed_at"] = datetime.now().isoformat()
                db_job.status = "completed"
                db_job.completed_at = datetime.now()
                
                # Parse results and save to database
                await _save_pairlist_results(job_id, job_info, session)
                
                logger.info(f"Pairlist job {job_id} completed successfully")
            
            await session.commit()
            
        except Exception as e:
            job_info["status"] = "failed"
            job_info["error"] = str(e)
            logger.error(f"Pairlist job {job_id} error: {e}")
            
            try:
                db_job = await session.get(PairlistJob, job_id)
                if db_job:
                    db_job.status = "failed"
                    db_job.error_message = str(e)[:1000]
                    await session.commit()
            except:
                pass

        finally:
            # Cleanup Docker container
            try:
                subprocess.run(["docker", "rm", "-f", job_id], capture_output=True, timeout=10)
            except Exception:
                pass

async def _save_pairlist_results(job_id: str, job_info: Dict, session: AsyncSession):
    """Parse JSON results and save to database"""
    
    output_file = job_info.get("output_file")
    if not output_file or not os.path.exists(output_file):
        logger.warning(f"Output file not found: {output_file}")
        return
    
    try:
        with open(output_file, 'r') as f:
            data = json.load(f)
        
        strategy = data.get('strategy', job_info["strategy"])
        timeframe = data.get('timeframe', 'unknown')
        evaluation_mode = data.get('evaluation_mode', 'unknown')
        total_pairs = data.get('total_evaluated', 0)
        
        # Save summary
        summary = data.get('summary', {})
        result_entry = PairlistResult(
            job_id=job_id,
            strategy=strategy,
            timeframe=timeframe,
            evaluation_mode=evaluation_mode,
            total_pairs=total_pairs,
            best_pair=summary.get('best_pair', ''),
            best_profit=summary.get('best_profit', 0),
            best_sharpe=summary.get('best_sharpe', 0),
            avg_profit=summary.get('avg_profit_total', 0),
            avg_win_rate=summary.get('avg_win_rate', 0),
            results_json=data,
            created_at=datetime.now()
        )
        session.add(result_entry)
        
        # Save individual pair details
        for rank, pair_data in enumerate(data.get('detailed_metrics', []), 1):
            pair_entry = PairlistPairResult(
                job_id=job_id,
                pair=pair_data.get('pair', ''),
                rank=rank,
                profit_total=pair_data.get('profit_total', 0),
                win_rate=pair_data.get('win_rate', 0),
                max_drawdown=pair_data.get('max_drawdown', 0),
                sharpe_ratio=pair_data.get('sharpe_ratio', 0),
                trade_count=pair_data.get('trade_count', 0),
                score=pair_data.get('score', 0),
                metrics_json=pair_data
            )
            session.add(pair_entry)
        
        await session.commit()
        logger.info(f"Saved {total_pairs} pair results to database for job {job_id}")
        
    except Exception as e:
        logger.error(f"Failed to save pairlist results: {e}")

@router.get("/pairlist-selector/status/{job_id}", response_model=PairlistStatus)
async def get_pairlist_status(job_id: str) -> PairlistStatus:
    """Get status of a running or completed pairlist job"""
    
    if job_id in running_jobs:
        job = running_jobs[job_id]
        return PairlistStatus(
            job_id=job_id,
            status=job["status"],
            strategy=job.get("strategy", ""),
            progress=job.get("progress"),
            created_at=job.get("created_at"),
            completed_at=job.get("completed_at"),
            error=job.get("error")
        )
    
    # Check database for completed/failed jobs
    # TODO: Query from database
    raise HTTPException(status_code=404, detail="Job not found")

@router.get("/pairlist-selector/jobs", response_model=List[PairlistStatus])
async def list_pairlist_jobs(
    session: AsyncSession = Depends(get_db)
) -> List[PairlistStatus]:
    """List all pairlist jobs (running and recent)"""
    
    jobs = []
    
    # Add running jobs
    for job_id, job in running_jobs.items():
        jobs.append(PairlistStatus(
            job_id=job_id,
            status=job["status"],
            strategy=job.get("strategy", ""),
            progress=job.get("progress"),
            created_at=job.get("created_at")
        ))
    
    # TODO: Query recent jobs from database
    
    return sorted(jobs, key=lambda x: x.created_at or "", reverse=True)

@router.get("/pairlist-selector/results/{job_id}")
async def get_pairlist_results(job_id: str) -> Dict:
    """Get detailed results for a completed pairlist job"""
    
    # Try to read from JSON file
    results_dir = "/opt/Multibotdashboard/results/pairlists"
    safe_job_id = os.path.basename(job_id)  # prevent path traversal
    json_file = f"{results_dir}/optimal_pairs_{safe_job_id}.json"
    
    if os.path.exists(json_file):
        with open(json_file, 'r') as f:
            return json.load(f)
    
    # Fallback to database
    # TODO: Query from database
    raise HTTPException(status_code=404, detail="Results not found")

@router.post("/pairlist-selector/stop/{job_id}")
async def stop_pairlist_job(job_id: str) -> Dict:
    """Stop a running pairlist job"""
    
    if job_id not in running_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        # Stop Docker container
        subprocess.run(["docker", "stop", "-t", "30", job_id], check=False)
        subprocess.run(["docker", "rm", job_id], check=False)
        
        running_jobs[job_id]["status"] = "stopped"
        
        return {"message": f"Job {job_id} stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
