// Estimate: ~$3 per 1M tokens. Real pricing comes with real buyers.

import type { SessionMeta } from "./types.js";

const RATE_PER_MILLION_TOKENS = 3;

export function estimateUsd(sessions: SessionMeta[]): number {
  const tokens = sessions.reduce(
    (a, s) => a + s.tokensIn + s.tokensOut + s.cacheCreationTokens + s.cacheReadTokens,
    0,
  );
  return round2((tokens / 1_000_000) * RATE_PER_MILLION_TOKENS);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
