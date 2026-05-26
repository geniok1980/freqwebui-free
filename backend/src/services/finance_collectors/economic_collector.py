"""
Economic indicators collector for MultibotdashboardV7
Fetches data from FRED (Federal Reserve Economic Data)
"""

import asyncio
import aiohttp
import asyncpg
import os
from datetime import datetime
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

# Key FRED indicators
FRED_INDICATORS = {
    'FEDFUNDS': 'Federal Funds Rate',
    'CPIAUCSL': 'Consumer Price Index',
    'UNRATE': 'Unemployment Rate',
    'GDP': 'Gross Domestic Product',
    'DGS10': '10-Year Treasury Yield',
    'DGS2': '2-Year Treasury Yield',
}

class EconomicCollector:
    """Collects economic indicators from FRED."""
    
    def __init__(self):
        self.base_url = "https://api.stlouisfed.org/fred/series/observations"
        host = os.getenv("FINANCE_DB_HOST") or os.getenv("DB_HOST") or "postgres"
        port = int(os.getenv("FINANCE_DB_PORT") or os.getenv("DB_PORT") or "5432")
        user = os.getenv("FINANCE_DB_USER") or os.getenv("DB_USER") or "dashboard"
        password = os.getenv("FINANCE_DB_PASSWORD") or os.getenv("DB_PASSWORD") or "dashboard"
        database = os.getenv("FINANCE_DB_NAME") or "financial_data"
        self.db_config = {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database,
        }
        # FRED API key - free at research.stlouisfed.org
        self.api_key = None  # Add to config
    
    async def fetch_indicator(self, series_id: str) -> Optional[Dict]:
        """Fetch a single indicator from FRED."""
        if not self.api_key:
            return None
            
        url = self.base_url
        params = {
            'series_id': series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'limit': 1,
            'sort_order': 'desc'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    obs = data.get('observations', [])
                    if obs:
                        return {
                            'indicator_id': series_id,
                            'name': FRED_INDICATORS.get(series_id, series_id),
                            'value': float(obs[0]['value']) if obs[0]['value'] != '.' else None,
                            'date': obs[0]['date']
                        }
                else:
                    logger.warning(f"FRED API error for {series_id}: {response.status}")
        return None
    
    async def fetch_mock_data(self) -> List[Dict]:
        """Return mock economic data for demo."""
        return [
            {'indicator_id': 'FEDFUNDS', 'name': 'Federal Funds Rate', 'value': 4.50, 'date': '2026-02-01'},
            {'indicator_id': 'CPIAUCSL', 'name': 'Consumer Price Index', 'value': 313.55, 'date': '2026-01-15'},
            {'indicator_id': 'UNRATE', 'name': 'Unemployment Rate', 'value': 3.7, 'date': '2026-02-01'},
            {'indicator_id': 'GDP', 'name': 'GDP Growth Rate', 'value': 2.8, 'date': '2026-01-30'},
            {'indicator_id': 'DGS10', 'name': '10-Year Treasury', 'value': 4.25, 'date': '2026-02-27'},
            {'indicator_id': 'DGS2', 'name': '2-Year Treasury', 'value': 4.15, 'date': '2026-02-27'},
        ]
    
    async def save_to_db(self, indicators: List[Dict]):
        """Save economic data to database."""
        from datetime import date
        pool = await asyncpg.create_pool(**self.db_config)
        
        async with pool.acquire() as conn:
            for ind in indicators:
                if ind['value'] is None:
                    continue
                
                # Convert string date to date object
                date_str = ind['date']
                if isinstance(date_str, str):
                    date_obj = date.fromisoformat(date_str)
                else:
                    date_obj = date_str
                    
                await conn.execute(
                    """
                    INSERT INTO economic_indicators 
                    (indicator_id, name, value, date)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (indicator_id, date) DO UPDATE SET
                    value = EXCLUDED.value,
                    timestamp = NOW()
                    """,
                    ind['indicator_id'],
                    ind['name'],
                    ind['value'],
                    date_obj
                )
        
        await pool.close()
        logger.info(f"Saved {len(indicators)} economic indicators to DB")
    
    async def run(self):
        """Run the collector."""
        try:
            logger.info("Starting economic data collection...")
            
            if self.api_key:
                indicators = []
                for series_id in FRED_INDICATORS.keys():
                    data = await self.fetch_indicator(series_id)
                    if data:
                        indicators.append(data)
            else:
                indicators = await self.fetch_mock_data()
            
            if indicators:
                await self.save_to_db(indicators)
                await self._log_sync('economic', 'success', len(indicators))
            else:
                await self._log_sync('economic', 'error', 0, 'No data received')
        except Exception as e:
            logger.error(f"Economic collector error: {e}")
            await self._log_sync('economic', 'error', 0, str(e))
    
    async def _log_sync(self, source: str, status: str, records: int, error: str = None):
        """Log sync status."""
        pool = await asyncpg.create_pool(**self.db_config)
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO sync_log (source, status, records_processed, error_message, started_at, completed_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                """,
                source, status, records, error
            )
        await pool.close()

# Singleton instance
economic_collector = EconomicCollector()
