// Validates incoming body against the batch schema. Rejects unknown fields.

import type { BatchPayload } from "./types.js";
import { SESSION_KEYS } from "./types.js";

const BATCH_KEYS = ["version", "app", "batchId", "createdAt", "sessions"];
const TOOLS = new Set(["claude", "cursor", "codex", "copilot"]);

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

  if (typeof s.tool !== "string" || !TOOLS.has(s.tool)) {
    return err("session tool must be claude, cursor, codex, or copilot");
  }
  if (!isString(s.model)) return err("session model required");
  if (!isStringArray(s.modelsUsed)) return err("session modelsUsed must be string array");
  if (!isString(s.startedAt)) return err("session startedAt required");
  if (!isString(s.endedAt)) return err("session endedAt required");
  if (!isNum(s.durationSec)) return err("session durationSec required");
  if (!isNum(s.hourOfDay)) return err("session hourOfDay required");
  if (!isNum(s.dayOfWeek)) return err("session dayOfWeek required");
  if (!isString(s.cliVersion)) return err("session cliVersion required");
  if (!isNum(s.userTurns)) return err("session userTurns required");
  if (!isNum(s.assistantTurns)) return err("session assistantTurns required");
  if (!isNum(s.tokensIn)) return err("session tokensIn required");
  if (!isNum(s.tokensOut)) return err("session tokensOut required");
  if (!isNum(s.cacheCreationTokens)) return err("session cacheCreationTokens required");
  if (!isNum(s.cacheReadTokens)) return err("session cacheReadTokens required");
  if (!isNum(s.cacheHitRatio)) return err("session cacheHitRatio required");
  if (!isNum(s.webSearchRequests)) return err("session webSearchRequests required");
  if (!isNum(s.webFetchRequests)) return err("session webFetchRequests required");
  if (!isString(s.serviceTier)) return err("session serviceTier required");
  if (!isString(s.speed)) return err("session speed required");
  if (!isString(s.taskType)) return err("session taskType required");
  if (typeof s.success !== "boolean") return err("session success required");
  if (!isString(s.lastStopReason)) return err("session lastStopReason required");
  if (!isNum(s.apiErrorCount)) return err("session apiErrorCount required");
  if (!isNum(s.toolErrorCount)) return err("session toolErrorCount required");
  if (!isNum(s.toolCallCount)) return err("session toolCallCount required");
  if (!isStringArray(s.toolsUsed)) return err("session toolsUsed must be string array");
  if (!isToolCalls(s.toolCalls)) return err("session toolCalls invalid");
  if (!isStringArray(s.toolSequence)) return err("session toolSequence must be string array");
  if (!isNum(s.thinkingBlocks)) return err("session thinkingBlocks required");
  if (!isNum(s.thinkingChars)) return err("session thinkingChars required");
  if (!isNum(s.textCharsOut)) return err("session textCharsOut required");
  if (!isNum(s.userCharsIn)) return err("session userCharsIn required");
  if (typeof s.isSubagent !== "boolean") return err("session isSubagent required");
  if (!isString(s.cwdHash)) return err("session cwdHash required");
  if (typeof s.hasGit !== "boolean") return err("session hasGit required");
  if (!isString(s.branchClass)) return err("session branchClass required");
  if (!isStringArray(s.langHints)) return err("session langHints must be string array");
  if (!isString(s.permissionMode)) return err("session permissionMode required");
  if (!isStopReasons(s.stopReasons)) return err("session stopReasons invalid");

  const extra = Object.keys(s).filter((k) => !(SESSION_KEYS as readonly string[]).includes(k));
  if (extra.length > 0) return err(`session unknown field: ${extra[0]}`);
  return { ok: true };
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isToolCalls(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    const extra = Object.keys(t).filter((k) => !["name", "count", "errors"].includes(k));
    return extra.length === 0 && typeof t.name === "string" && isNum(t.count) && isNum(t.errors);
  });
}

function isStopReasons(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    const extra = Object.keys(t).filter((k) => !["reason", "count"].includes(k));
    return extra.length === 0 && typeof t.reason === "string" && isNum(t.count);
  });
}

function err(error: string) {
  return { ok: false as const, error };
}
