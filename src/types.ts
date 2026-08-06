// Mirrors the client schema (iolit-client/src/types.ts).
// If a field is not here, the API rejects it.

export interface SessionMeta {
  tool: "claude" | "cursor";
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
