// Estimate: $3 per 1M tokens, times the share-tier multiplier.

import type { SessionMeta, ShareTier } from "./types.js";

const RATE_PER_MILLION_TOKENS = 3;
const TIER_MULT: Record<ShareTier, number> = {
  pulse: 1,
  trace: 4,
  raw: 12,
};

export function estimateUsd(sessions: SessionMeta[], tier?: ShareTier): number {
  const tokens = sessions.reduce(
    (a, s) => a + s.tokensIn + s.tokensOut + s.cacheCreationTokens + s.cacheReadTokens,
    0,
  );
  const used = tier ?? sessions[0]?.shareTier ?? "pulse";
  return round2((tokens / 1_000_000) * RATE_PER_MILLION_TOKENS * TIER_MULT[used]);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
