"""
Process manager for FreqTrade - Docker/Linux adaptation.
"""

import os
import subprocess
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Callable, Optional
import docker

from .config import AppConfig, StrategyConfig
from .state import AppState, ProcessInfo, ProcessStats, ProcessType, ProcessStatus

logger = logging.getLogger(__name__)


def calc_timerange(start_days_ago: int, end_days_ago: int) -> str:
    """Calculate freqtrade timerange string from days-ago values."""
    start = (datetime.now() - timedelta(days=start_days_ago)).strftime("%Y%m%d")
    if end_days_ago == 0:
        return f"{start}-"
    end = (datetime.now() - timedelta(days=end_days_ago)).strftime("%Y%m%d")
    return f"{start}-{end}"


class DockerProcessManager:
    """Manages freqtrade processes using Docker containers."""

    def __init__(self, config: AppConfig, state: AppState):
        self.config = config
        self.state = state
        self.docker_client = docker.from_env()
        self._lock = threading.Lock()

    def _build_docker_cmd(
        self,
        process_type: ProcessType,
        strategy: StrategyConfig,
        extra_args: list = None,
    ) -> list:
        """Build Docker command for a process type."""
        base_cmd = [
            "docker", "run", "--rm",
            "-v", f"{self.config.freqtrade.directory}/user_data:/freqtrade/user_data",
            "-v", f"{self.config.freqtrade.directory}/config:/freqtrade/config",
            self.config.freqtrade.docker_image or "freqtradeorg/freqtrade:stable_freqaitorch",
        ]

        if process_type == ProcessType.TRADE:
            cmd = base_cmd + [
                "trade",
                "--config", strategy.config_path,
                "--strategy", strategy.name,
            ]
        elif process_type == ProcessType.BACKTEST:
            timerange = calc_timerange(
                strategy.backtest_timerange_start_days_ago,
                strategy.backtest_timerange_end_days_ago,
            )
            cmd = base_cmd + [
                "backtesting",
                "--config", strategy.config_path,
                "--strategy", strategy.name,
                "--timerange", timerange,
                "--timeframe", strategy.timeframe or "15m",
                "--cache", "none",
            ]
        elif process_type == ProcessType.HYPEROPT:
            timerange = calc_timerange(
                strategy.hyperopt_timerange_start_days_ago,
                strategy.hyperopt_timerange_end_days_ago,
            )
            cmd = base_cmd + [
                "hyperopt",
                "--config", strategy.config_path,
                "--strategy", strategy.name,
                "--timerange", timerange,
                "--timeframe", strategy.timeframe or "15m",
                "--epochs", str(strategy.epochs or 30),
                "--spaces", strategy.hyperopt_spaces or "buy sell",
                "--hyperopt-loss", strategy.hyperopt_loss or "SharpeHyperOptLoss",
                "-j", "4",
            ]
        elif process_type in (ProcessType.DOWNLOAD_DATA, ProcessType.DOWNLOAD):
            cmd = base_cmd + [
                "download-data",
                "--config", strategy.config_path,
                "--timeframe", strategy.timeframe or "15m",
                "--days", "30",
            ]
        else:
            raise ValueError(f"Unknown process type: {process_type}")

        if extra_args:
            cmd.extend(extra_args)

        return cmd

    def build_hyperopt_show_cmd(self, strategy: StrategyConfig, epoch_num: int) -> list[str]:
        """Build command to extract epoch params via hyperopt-show."""
        return [
            "docker", "run", "--rm",
            "-v", f"{self.config.freqtrade.directory}/user_data:/freqtrade/user_data",
            self.config.freqtrade.docker_image or "freqtradeorg/freqtrade:stable_freqaitorch",
            "hyperopt-show",
            "--config", strategy.config_path,
            "--strategy", strategy.name,
            "--epoch", str(epoch_num),
        ]

    def is_running(self, process_type: ProcessType, strategy_name: str) -> bool:
        """Check if a process is running for a strategy."""
        info = self.state.get_process(process_type, strategy_name)
        return info is not None and info.status == ProcessStatus.RUNNING

    def _make_info(self, process_type: ProcessType, strategy_name: str, pid: int = None,
                   status: ProcessStatus = ProcessStatus.STARTING) -> ProcessInfo:
        """Create a ProcessInfo with correct field names for state.py."""
        return ProcessInfo(
            process_type=process_type,
            strategy=strategy_name,
            status=status,
            pid=pid,
            started_at=time.time(),
        )

    # ── Public API ──

    def start_process(
        self,
        process_type: ProcessType,
        strategy: StrategyConfig,
        cmd: list = None,
        on_output: Callable[[str], None] = None,
        on_complete: Callable[[int], None] = None,
    ) -> bool:
        """Start a Docker container for a process. Returns True on success."""
        if self.is_running(process_type, strategy.name):
            logger.warning(f"Process {process_type.value}:{strategy.name} already running")
            return False

        if cmd is None:
            cmd = self._build_docker_cmd(process_type, strategy)

        logger.info(f"Starting {process_type.value} for {strategy.name}: {' '.join(cmd)}")

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            info = self._make_info(process_type, strategy.name, pid=process.pid, status=ProcessStatus.RUNNING)
            self.state.set_process(process_type, strategy.name, info)

            if on_output:
                threading.Thread(
                    target=self._read_output,
                    args=(process, process_type, strategy.name, on_output, on_complete),
                    daemon=True,
                ).start()
            else:
                threading.Thread(
                    target=self._wait_process,
                    args=(process, process_type, strategy.name, on_complete),
                    daemon=True,
                ).start()

            return True

        except Exception as e:
            logger.error(f"Failed to start process {process_type.value}:{strategy.name}: {e}")
            return False

    def stop_process(
        self,
        process_type: ProcessType,
        strategy_name: str,
        timeout: int = 60,
    ) -> bool:
        """Stop a running process for a strategy."""
        info = self.state.get_process(process_type, strategy_name)
        if not info or info.status != ProcessStatus.RUNNING:
            return False

        # Mark as stopping
        info.status = ProcessStatus.STOPPING
        self.state.set_process(process_type, strategy_name, info)

        logger.info(f"Stopping {process_type.value}:{strategy_name}")
        try:
            # Try graceful stop via docker stop on the container
            result = subprocess.run(
                ["docker", "ps", "-q", "--filter", f"name=ft_{strategy_name.lower()}_{process_type.value}"],
                capture_output=True, text=True, timeout=10,
            )
            container_id = result.stdout.strip()
            if container_id:
                subprocess.run(
                    ["docker", "stop", "-t", str(timeout), container_id],
                    capture_output=True, timeout=timeout + 10,
                )

            info.status = ProcessStatus.COMPLETED
            info.stopped_at = time.time()
            self.state.set_process(process_type, strategy_name, info)
            return True

        except Exception as e:
            logger.error(f"Failed to stop {process_type.value}:{strategy_name}: {e}")
            info.status = ProcessStatus.FAILED
            info.error = str(e)
            self.state.set_process(process_type, strategy_name, info)
            return False

    def run_and_wait(
        self,
        process_type: ProcessType,
        strategy: StrategyConfig,
        on_line: Callable[[str], None] = None,
        timeout: int = 0,
        cancel_event: threading.Event = None,
        cmd: list = None,
    ) -> int:
        """Run a process synchronously and wait for completion. Returns exit code."""
        if cmd is None:
            cmd = self._build_docker_cmd(process_type, strategy)

        logger.info(f"Running {process_type.value} for {strategy.name}: {' '.join(cmd)}")

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            info = self._make_info(process_type, strategy.name, pid=process.pid, status=ProcessStatus.RUNNING)
            self.state.set_process(process_type, strategy.name, info)
        except Exception as e:
            logger.error(f"Failed to start {process_type.value}:{strategy.name}: {e}")
            return -1

        return_code = -1
        cancelled = False
        try:
            start_time = time.time()
            for raw_line in iter(process.stdout.readline, ""):
                if cancel_event and cancel_event.is_set():
                    cancelled = True
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    break

                if timeout > 0 and (time.time() - start_time) > timeout:
                    logger.warning(f"Process {process_type.value}:{strategy.name} timed out after {timeout}s")
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    break

                line = raw_line.rstrip()
                if line and on_line:
                    try:
                        on_line(line)
                    except Exception:
                        pass

            if not cancelled:
                process.wait()
            return_code = process.returncode or 0

        except Exception as e:
            logger.error(f"Error in run_and_wait {process_type.value}:{strategy.name}: {e}")
            return_code = -1

        finally:
            final_status = (
                ProcessStatus.COMPLETED if cancelled or return_code == 0
                else ProcessStatus.FAILED
            )
            info = self.state.get_process(process_type, strategy.name)
            if info:
                info.status = final_status
                info.return_code = return_code
                info.stopped_at = time.time()
                self.state.set_process(process_type, strategy.name, info)

        return return_code

    # ── Internal helpers ──

    def _read_output(
        self,
        process: subprocess.Popen,
        process_type: ProcessType,
        strategy_name: str,
        on_output: Callable[[str], None],
        on_complete: Callable[[int], None] = None,
    ):
        """Read output from process and call callback."""
        try:
            for line in iter(process.stdout.readline, ""):
                if line:
                    on_output(line.rstrip())
                    self.state.append_output(process_type, strategy_name, line.rstrip())

            process.wait()
            return_code = process.returncode or 0

        except Exception as e:
            logger.error(f"Error reading output for {process_type.value}:{strategy_name}: {e}")
            return_code = -1

        finally:
            info = self.state.get_process(process_type, strategy_name)
            if info:
                info.status = ProcessStatus.COMPLETED if return_code == 0 else ProcessStatus.FAILED
                info.return_code = return_code
                info.stopped_at = time.time()
                self.state.set_process(process_type, strategy_name, info)
            if on_complete:
                on_complete(return_code)

    def _wait_process(
        self,
        process: subprocess.Popen,
        process_type: ProcessType,
        strategy_name: str,
        on_complete: Callable[[int], None] = None,
    ):
        """Wait for process completion without reading output."""
        try:
            return_code = process.wait() or 0
        except Exception as e:
            logger.error(f"Error waiting for {process_type.value}:{strategy_name}: {e}")
            return_code = -1

        info = self.state.get_process(process_type, strategy_name)
        if info:
            info.status = ProcessStatus.COMPLETED if return_code == 0 else ProcessStatus.FAILED
            info.return_code = return_code
            info.stopped_at = time.time()
            self.state.set_process(process_type, strategy_name, info)
        if on_complete:
            on_complete(return_code)

    def get_process_stats(self, process_type: ProcessType, strategy_name: str) -> Optional[ProcessStats]:
        """Get current stats for a running process."""
        info = self.state.get_process(process_type, strategy_name)
        if not info or info.status != ProcessStatus.RUNNING:
            return None

        try:
            result = subprocess.run(
                ["docker", "stats", "--no-stream", "--format", "{{.CPUPerc}},{{.MemUsage}}"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                parts = result.stdout.strip().split(",")
                cpu_str = parts[0].replace("%", "").strip() if parts else ""
                mem_str = parts[1].split("/")[0].strip() if len(parts) > 1 else "0MiB"

                try:
                    cpu = float(cpu_str)
                except (ValueError, TypeError):
                    cpu = 0.0

                mem_mb = 0.0
                if "GiB" in mem_str:
                    mem_mb = float(mem_str.replace("GiB", "")) * 1024
                elif "MiB" in mem_str:
                    mem_mb = float(mem_str.replace("MiB", ""))
                elif "GB" in mem_str:
                    mem_mb = float(mem_str.replace("GB", "")) * 1024
                elif "MB" in mem_str:
                    mem_mb = float(mem_str.replace("MB", ""))

                stats = ProcessStats(
                    cpu_percent=cpu,
                    memory_mb=mem_mb,
                )
                self.state.update_stats(process_type, strategy_name, stats)
                return stats
        except Exception as e:
            logger.debug(f"Could not get stats for {process_type.value}:{strategy_name}: {e}")

        return None

    def cleanup_old_containers(self, strategy_name: str = None):
        """Clean up old/stopped freqtrade containers."""
        try:
            result = subprocess.run(
                [
                    "docker", "ps", "-a",
                    "--filter", f"ancestor={self.config.freqtrade.docker_image or 'freqtradeorg/freqtrade'}",
                    "--format", "{{.ID}} {{.Status}} {{.Names}}",
                ],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                return

            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    container_id = parts[0]
                    status = " ".join(parts[1:-1]) if len(parts) > 2 else parts[1]

                    if "Exited" in status:
                        subprocess.run(["docker", "rm", container_id], capture_output=True)
                        logger.info(f"Cleaned up old container {container_id}")

        except Exception as e:
            logger.error(f"Container cleanup failed: {e}")


# Backward compatibility alias
ProcessManager = DockerProcessManager
