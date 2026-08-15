// Mirrors iolit-client/src/types.ts. API rejects anything not in this schema.

export interface SessionMeta {
  tool: "claude" | "cursor" | "codex";
  model: string;
  startedAt: string;
  durationSec: number;
  tokensIn: number;
  tokensOut: number;
  taskType: string;
  success: boolean;
  toolsUsed: string[];
  hourOfDay: number;
}

export interface BatchPayload {
  version: 1;
  app: "iolit";
  batchId: string;
  createdAt: string;
  sessions: SessionMeta[];
}

export interface BatchRecord extends BatchPayload {
  status: "received";
  receivedAt: string;
  estEarningsUsd: number;
}
