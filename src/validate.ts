// Validates incoming body against the batch schema. Rejects unknown fields.

import type { BatchPayload } from "./types.js";
import { BATCH_KEYS, SESSION_KEYS } from "./types.js";

const TOOLS = new Set(["claude", "cursor", "codex", "hermes"]);
const TIERS = new Set(["pulse", "trace", "raw"]);

export function parseBatch(body: unknown): { ok: true; value: BatchPayload } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return err("body must be an object");
  const b = body as Record<string, unknown>;

  if (b.version !== 1) return err("version must be 1");
  if (b.app !== "iolit") return err("app must be iolit");
  if (typeof b.batchId !== "string" || b.batchId.length === 0) return err("batchId required");
  if (typeof b.createdAt !== "string") return err("createdAt required");
  if (typeof b.shareTier !== "string" || !TIERS.has(b.shareTier)) return err("shareTier must be pulse, trace, or raw");
  if (!Array.isArray(b.sessions) || b.sessions.length === 0) return err("sessions must be a non-empty array");

  const extra = Object.keys(b).filter((k) => !(BATCH_KEYS as readonly string[]).includes(k));
  if (extra.length > 0) return err(`unknown field: ${extra[0]}`);

  for (const s of b.sessions) {
    const v = parseSession(s, b.shareTier);
    if (!v.ok) return v;
  }

  return { ok: true, value: b as unknown as BatchPayload };
}

function parseSession(body: unknown, batchTier: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return err("session must be an object");
  const s = body as Record<string, unknown>;

  if (typeof s.tool !== "string" || !TOOLS.has(s.tool)) {
    return err("session tool must be claude, cursor, codex, or hermes");
  }
  if (!isString(s.model)) return err("session model required");
  if (!isStringArray(s.modelsUsed)) return err("session modelsUsed must be string array");
  if (!isString(s.startedAt)) return err("session startedAt required");
  if (!isString(s.endedAt)) return err("session endedAt required");
  if (!isNonNeg(s.durationSec)) return err("session durationSec must be a non-negative number");
  if (!isHourOfDay(s.hourOfDay)) return err("session hourOfDay must be 0-23");
  if (!isDayOfWeek(s.dayOfWeek)) return err("session dayOfWeek must be 0-6");
  if (!isString(s.cliVersion)) return err("session cliVersion required");
  if (!isNonNeg(s.userTurns)) return err("session userTurns must be a non-negative number");
  if (!isNonNeg(s.assistantTurns)) return err("session assistantTurns must be a non-negative number");
  if (!isNonNeg(s.tokensIn)) return err("session tokensIn must be a non-negative number");
  if (!isNonNeg(s.tokensOut)) return err("session tokensOut must be a non-negative number");
  if (!isNonNeg(s.cacheCreationTokens)) return err("session cacheCreationTokens must be a non-negative number");
  if (!isNonNeg(s.cacheReadTokens)) return err("session cacheReadTokens must be a non-negative number");
  if (!isRatio(s.cacheHitRatio)) return err("session cacheHitRatio must be between 0 and 1");
  if (!isNonNeg(s.webSearchRequests)) return err("session webSearchRequests must be a non-negative number");
  if (!isNonNeg(s.webFetchRequests)) return err("session webFetchRequests must be a non-negative number");
  if (!isString(s.serviceTier)) return err("session serviceTier required");
  if (!isString(s.speed)) return err("session speed required");
  if (!isString(s.taskType)) return err("session taskType required");
  if (typeof s.success !== "boolean") return err("session success required");
  if (!isString(s.lastStopReason)) return err("session lastStopReason required");
  if (!isNonNeg(s.apiErrorCount)) return err("session apiErrorCount must be a non-negative number");
  if (!isNonNeg(s.toolErrorCount)) return err("session toolErrorCount must be a non-negative number");
  if (!isNonNeg(s.toolCallCount)) return err("session toolCallCount must be a non-negative number");
  if (!isStringArray(s.toolsUsed)) return err("session toolsUsed must be string array");
  if (!isToolCalls(s.toolCalls)) return err("session toolCalls invalid");
  if (!isStringArray(s.toolSequence)) return err("session toolSequence must be string array");
  if (!isNonNeg(s.thinkingBlocks)) return err("session thinkingBlocks must be a non-negative number");
  if (!isNonNeg(s.thinkingChars)) return err("session thinkingChars must be a non-negative number");
  if (!isNonNeg(s.textCharsOut)) return err("session textCharsOut must be a non-negative number");
  if (!isNonNeg(s.userCharsIn)) return err("session userCharsIn must be a non-negative number");
  if (typeof s.isSubagent !== "boolean") return err("session isSubagent required");
  if (!isString(s.cwdHash)) return err("session cwdHash required");
  if (typeof s.hasGit !== "boolean") return err("session hasGit required");
  if (!isString(s.branchClass)) return err("session branchClass required");
  const prov = parseProvenance(s.provenance);
  if (!prov.ok) return prov;
  if (!isStringArray(s.langHints)) return err("session langHints must be string array");
  if (!isString(s.permissionMode)) return err("session permissionMode required");
  if (!isStopReasons(s.stopReasons)) return err("session stopReasons invalid");
  if (typeof s.shareTier !== "string" || !TIERS.has(s.shareTier)) return err("session shareTier invalid");
  if (s.shareTier !== batchTier) return err("session shareTier must match batch");
  if (!isToolEvents(s.toolEvents)) return err("session toolEvents invalid");
  if (!isString(s.userPromptPreview)) return err("session userPromptPreview required");
  if (!isString(s.assistantPreview)) return err("session assistantPreview required");
  if (!isString(s.thinkingPreview)) return err("session thinkingPreview required");

  if (s.shareTier === "pulse") {
    if ((s.toolEvents as unknown[]).length > 0) return err("pulse forbids toolEvents");
    if (s.userPromptPreview || s.assistantPreview || s.thinkingPreview) {
      return err("pulse forbids text previews");
    }
  }
  if (s.shareTier === "trace") {
    if (s.userPromptPreview || s.assistantPreview || s.thinkingPreview) {
      return err("trace forbids text previews");
    }
  }

  const secretScan = scanPreviewSecrets(s);
  if (!secretScan.ok) return secretScan;

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

// Counters feed the earnings estimate and the analytics; negatives corrupt both.
function isNonNeg(v: unknown): v is number {
  return isNum(v) && v >= 0;
}

function isHourOfDay(v: unknown): v is number {
  return isNum(v) && v >= 0 && v <= 23;
}

function isDayOfWeek(v: unknown): v is number {
  return isNum(v) && v >= 0 && v <= 6;
}

function isRatio(v: unknown): v is number {
  return isNum(v) && v >= 0 && v <= 1;
}

// High-confidence credential shapes only, to avoid false positives on code
// that merely mentions keys. The client scrubs secrets on-device; this is
// the server-side safety net so a missed secret never lands in the store.
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "aws access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "private key", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: "github token", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "github token", re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: "slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "anthropic key", re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/ },
];

function findSecret(text: string): string | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(text)) return p.name;
  }
  return null;
}

// Scan free-text preview fields for leaked credentials. The error names the
// field but never echoes the value, so a secret is not bounced back.
function scanPreviewSecrets(s: Record<string, unknown>): { ok: true } | { ok: false; error: string } {
  const fields = ["userPromptPreview", "assistantPreview", "thinkingPreview"] as const;
  for (const field of fields) {
    const v = s[field];
    if (typeof v === "string") {
      const hit = findSecret(v);
      if (hit) return err(`possible ${hit} in session ${field}; scrub secrets before submitting`);
    }
  }
  const events = s.toolEvents;
  if (Array.isArray(events)) {
    for (const item of events) {
      if (typeof item !== "object" || item === null) continue;
      const e = item as Record<string, unknown>;
      for (const field of ["inputPreview", "resultPreview"] as const) {
        const v = e[field];
        if (typeof v === "string") {
          const hit = findSecret(v);
          if (hit) return err(`possible ${hit} in session toolEvents ${field}; scrub secrets before submitting`);
        }
      }
    }
  }
  return { ok: true };
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
    return extra.length === 0 && typeof t.name === "string" && isNonNeg(t.count) && isNonNeg(t.errors);
  });
}

function isStopReasons(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    const extra = Object.keys(t).filter((k) => !["reason", "count"].includes(k));
    return extra.length === 0 && typeof t.reason === "string" && isNonNeg(t.count);
  });
}

function parseProvenance(v: unknown): { ok: true } | { ok: false; error: string } {
  // Optional for backward compatibility with older clients; strict when present.
  if (v === undefined) return { ok: true };
  if (typeof v !== "object" || v === null) return err("session provenance must be an object");
  const p = v as Record<string, unknown>;
  const extra = Object.keys(p).filter((k) => k !== "commits");
  if (extra.length > 0) return err(`session provenance unknown field: ${extra[0]}`);
  if (!Array.isArray(p.commits)) return err("session provenance commits must be an array");
  if (p.commits.length > 20) return err("session provenance commits capped at 20");
  for (const c of p.commits) {
    if (typeof c !== "string" || !/^[0-9a-f]{40}$/.test(c)) {
      return err("session provenance commits must be 40-char hex SHAs");
    }
  }
  return { ok: true };
}

function isToolEvents(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const t = item as Record<string, unknown>;
    const extra = Object.keys(t).filter(
      (k) => !["name", "error", "exitCode", "argKeys", "inputPreview", "resultPreview"].includes(k),
    );
    const exitOk = t.exitCode === null || isNum(t.exitCode);
    return (
      extra.length === 0 &&
      typeof t.name === "string" &&
      typeof t.error === "boolean" &&
      exitOk &&
      isStringArray(t.argKeys) &&
      typeof t.inputPreview === "string" &&
      typeof t.resultPreview === "string"
    );
  });
}

function err(error: string) {
  return { ok: false as const, error };
}
