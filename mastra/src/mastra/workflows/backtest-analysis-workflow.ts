import { createStep, createWorkflow } from '../../types/mastra-core-workflows';
import { z } from '../../types/zod';

import { tradingAgent } from '../agents/trading-agent';

type SummaryInput = {
  inputData: {
    summary: string;
  };
};

type PromptInput = {
  inputData: {
    prompt: string;
  };
};

const buildBacktestPrompt = createStep({
  id: 'build-backtest-analysis-prompt',
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({
    prompt: z.string(),
  }),
  execute: async ({ inputData }: SummaryInput) => {
    return {
      prompt: [
        'Analyze the following FreqDash Strategy Lab run.',
        'Respond in Russian.',
        'Keep the answer concise and practical.',
        'Use four labeled paragraphs: Итог, Сильные стороны, Риски, Следующий шаг.',
        'Do not invent missing metrics.',
        '',
        inputData.summary,
      ].join('\n'),
    };
  },
});

const analyzeBacktest = createStep({
  id: 'analyze-backtest-run',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
  execute: async ({ inputData }: PromptInput) => {
    const response = await tradingAgent.generate(inputData.prompt);

    return {
      analysis: response.text,
    };
  },
});

export const backtestAnalysisWorkflow = createWorkflow({
  id: 'backtest-analysis-workflow',
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
})
  .then(buildBacktestPrompt)
  .then(analyzeBacktest)
  .commit();
