// Validates an incoming body against the exact batch schema.
// Rejects anything extra: unknown fields, wrong types, empty sessions.

import type { BatchPayload, SessionMeta } from "./types.js";

const SESSION_KEYS = [
  "tool", "model", "startedAt", "durationSec", "tokensIn", "tokensOut",
  "taskType", "success", "toolsUsed", "hourOfDay",
];
const BATCH_KEYS = ["version", "app", "batchId", "createdAt", "sessions"];

export function parseBatch(body: unknown): { ok: true; value: BatchPayload } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return err("body must be an object");
  const b = body as Record<string, unknown>;

  if (b.version !== 1) return err("version must be 1");
  if (b.app !== "iolit") return err("app must be iolit");
  if (typeof b.batchId !== "string" || b.batchId.length === 0) return err("batchId required");
  if (typeof b.createdAt !== "string") return err("createdAt required");
  if (!Array.isArray(b.sessions) || b.sessions.length === 0) return err("sessions must be a non-empty array");

  const extra = Object.keys(b).filter((k) => !BATCH_KEYS.includes(k));
  if (extra.length > 0) return err(`unknown field: ${extra[0]}`);

  for (const s of b.sessions) {
    const v = parseSession(s);
    if (!v.ok) return v;
  }

  return { ok: true, value: b as unknown as BatchPayload };
}

function parseSession(body: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return err("session must be an object");
  const s = body as Record<string, unknown>;

  if (s.tool !== "claude" && s.tool !== "cursor" && s.tool !== "codex") return err("session tool must be claude, cursor, or codex");
  if (typeof s.model !== "string") return err("session model required");
  if (typeof s.startedAt !== "string") return err("session startedAt required");
  if (typeof s.durationSec !== "number") return err("session durationSec required");
  if (typeof s.tokensIn !== "number") return err("session tokensIn required");
  if (typeof s.tokensOut !== "number") return err("session tokensOut required");
  if (typeof s.taskType !== "string") return err("session taskType required");
  if (typeof s.success !== "boolean") return err("session success required");
  if (!Array.isArray(s.toolsUsed) || s.toolsUsed.some((t) => typeof t !== "string")) return err("session toolsUsed must be string array");
  if (typeof s.hourOfDay !== "number") return err("session hourOfDay required");

  const extra = Object.keys(s).filter((k) => !SESSION_KEYS.includes(k));
  if (extra.length > 0) return err(`session unknown field: ${extra[0]}`);
  return { ok: true };
}

function err(error: string) {
  return { ok: false as const, error };
}
