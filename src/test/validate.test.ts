import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBatch } from "../validate.js";
import type { SessionMeta } from "../types.js";

const session: SessionMeta = {
  tool: "claude",
  model: "claude-opus-4-6",
  modelsUsed: ["claude-opus-4-6"],
  startedAt: "2026-08-06T00:00:00Z",
  endedAt: "2026-08-06T00:02:00Z",
  durationSec: 120,
  hourOfDay: 0,
  dayOfWeek: 4,
  cliVersion: "2.1.77",
  userTurns: 1,
  assistantTurns: 2,
  tokensIn: 1000,
  tokensOut: 500,
  cacheCreationTokens: 200,
  cacheReadTokens: 800,
  cacheHitRatio: 0.8,
  webSearchRequests: 0,
  webFetchRequests: 0,
  serviceTier: "standard",
  speed: "standard",
  taskType: "code",
  success: true,
  lastStopReason: "end_turn",
  apiErrorCount: 0,
  toolErrorCount: 0,
  toolCallCount: 1,
  toolsUsed: ["Read"],
  toolCalls: [{ name: "Read", count: 1, errors: 0 }],
  toolSequence: ["Read"],
  thinkingBlocks: 0,
  thinkingChars: 0,
  textCharsOut: 40,
  userCharsIn: 12,
  isSubagent: false,
  cwdHash: "abc123abc123",
  hasGit: true,
  branchClass: "main",
  langHints: ["ts"],
  permissionMode: "",
  stopReasons: [{ reason: "end_turn", count: 1 }],
  shareTier: "pulse",
  toolEvents: [],
  userPromptPreview: "",
  assistantPreview: "",
  thinkingPreview: "",
};

function batch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    app: "iolit",
    batchId: "abc123",
    createdAt: "2026-08-06T00:00:00Z",
    shareTier: "pulse",
    sessions: [session],
    ...overrides,
  };
}

test("accepts a valid batch", () => {
  const r = parseBatch(batch());
  assert.equal(r.ok, true);
});

test("rejects unknown top-level field", () => {
  const r = parseBatch(batch({ evil: true }));
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /unknown field/);
});

test("rejects unknown session field", () => {
  const r = parseBatch(batch({ sessions: [{ ...session, prompt: "secret" }] }));
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /unknown field/);
});

test("rejects empty sessions", () => {
  const r = parseBatch(batch({ sessions: [] }));
  assert.equal(r.ok, false);
});

test("rejects wrong version or app", () => {
  assert.equal(parseBatch(batch({ version: 2 })).ok, false);
  assert.equal(parseBatch(batch({ app: "evil" })).ok, false);
});

test("rejects malformed session types", () => {
  const r = parseBatch(batch({ sessions: [{ ...session, success: "yes" }] }));
  assert.equal(r.ok, false);
});

test("accepts cursor as a tool", () => {
  const r = parseBatch(batch({ sessions: [{ ...session, tool: "cursor" }] }));
  assert.equal(r.ok, true);
});

test("rejects pulse batch that still has prompts", () => {
  const r = parseBatch(batch({ sessions: [{ ...session, userPromptPreview: "hi" }] }));
  assert.equal(r.ok, false);
});

test("accepts a trace batch with tool events", () => {
  const traced: SessionMeta = {
    ...session,
    shareTier: "trace",
    toolEvents: [
      {
        name: "Read",
        error: false,
        exitCode: null,
        argKeys: ["file_path"],
        inputPreview: "file_path=*/app.ts",
        resultPreview: "ok",
      },
    ],
  };
  const r = parseBatch(batch({ shareTier: "trace", sessions: [traced] }));
  assert.equal(r.ok, true);
});
