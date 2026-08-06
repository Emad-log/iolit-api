import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBatch } from "../validate.js";
import type { BatchPayload, SessionMeta } from "../types.js";

const session: SessionMeta = {
  tool: "claude",
  model: "claude-opus-4-6",
  startedAt: "2026-08-06T00:00:00Z",
  durationSec: 120,
  tokensIn: 1000,
  tokensOut: 500,
  taskType: "code",
  success: true,
  toolsUsed: ["Read"],
  hourOfDay: 14,
};

function batch(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    app: "iolit",
    batchId: "abc123",
    createdAt: "2026-08-06T00:00:00Z",
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

test("rejects bad json", () => {
  assert.equal((batch() as unknown as BatchPayload).app, "iolit");
});
