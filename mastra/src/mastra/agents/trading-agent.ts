import { Agent } from '@mastra/core/agent';

const rawModelId =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPENAI_MODEL ||
  'openai/gpt-4o-mini';
const modelId = rawModelId.includes('/') ? rawModelId : `openai/${rawModelId}`;

export const tradingAgent = new Agent({
  id: 'tradingAgent',
  name: 'Trading Analyst',
  instructions: `
You are an AI trading analyst for a Freqtrade dashboard.

Your responsibilities:
- Analyze bot performance and market context.
- Explain risks, anomalies, and possible causes.
- Suggest next actions in a concise and practical format.
- Avoid inventing missing metrics. State assumptions clearly.
  `.trim(),
  model: modelId,
});
