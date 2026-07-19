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

const buildAnalysisPrompt = createStep({
  id: 'build-analysis-prompt',
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({
    prompt: z.string(),
  }),
  execute: async ({ inputData }: SummaryInput) => {
    return {
      prompt: [
        'Analyze the following Freqtrade dashboard summary.',
        'Focus on performance, risk, anomalies, and next actions.',
        '',
        inputData.summary,
      ].join('\n'),
    };
  },
});

const analyzeSummary = createStep({
  id: 'analyze-summary',
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

export const marketAnalysisWorkflow = createWorkflow({
  id: 'market-analysis-workflow',
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({
    analysis: z.string(),
  }),
})
  .then(buildAnalysisPrompt)
  .then(analyzeSummary)
  .commit();
