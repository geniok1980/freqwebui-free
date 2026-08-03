import { Mastra } from '../types/mastra-core';

import { tradingAgent } from './agents/trading-agent';
import { strategyGeneratorAgent } from './agents/strategy-generator-agent';
import { backtestAnalysisWorkflow } from './workflows/backtest-analysis-workflow';
import { marketAnalysisWorkflow } from './workflows/market-analysis-workflow';

export const mastra = new Mastra({
  agents: {
    tradingAgent,
    strategyGenerator: strategyGeneratorAgent,
  },
  workflows: {
    backtestAnalysisWorkflow,
    marketAnalysisWorkflow,
  },
  server: {
    host: '0.0.0.0',
    port: Number(
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT ?? 4111
    ),
  },
});
