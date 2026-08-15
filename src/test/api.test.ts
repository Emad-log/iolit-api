import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../store.js";
import { makeApp } from "../server.js";
import type { BatchRecord, SessionMeta } from "../types.js";

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "iolit-"));
  return { dir, store: new Store(dir) };
}

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
};

const record: BatchRecord = {
  version: 1,
  app: "iolit",
  batchId: "b1",
  createdAt: "2026-08-06T00:00:00Z",
  sessions: [session],
  status: "received",
  receivedAt: "2026-08-06T00:00:01Z",
  estEarningsUsd: 0.01,
};

test("store persists to disk and reloads", () => {
  const { dir, store } = tempStore();
  store.add(record);
  assert.equal(store.get("b1")?.batchId, "b1");

  const reloaded = new Store(dir);
  assert.equal(reloaded.get("b1")?.status, "received");
  rmSync(dir, { recursive: true, force: true });
});

test("store appends one JSON line per batch", () => {
  const { dir, store } = tempStore();
  store.add(record);
  const lines = readFileSync(join(dir, "batches.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  rmSync(dir, { recursive: true, force: true });
});

test("POST /v1/batches accepts and returns id + estimate", async () => {
  const { dir, store } = tempStore();
  const server = makeApp(store);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://127.0.0.1:${port}/v1/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, app: "iolit", batchId: "x1", createdAt: "2026-08-06T00:00:00Z", sessions: [session] }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.batchId, "x1");
  assert.equal(body.status, "received");
  assert.equal(typeof body.estEarningsUsd, "number");

  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

test("POST rejects invalid payload with 400", async () => {
  const { dir, store } = tempStore();
  const server = makeApp(store);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://127.0.0.1:${port}/v1/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, app: "iolit", batchId: "x2", createdAt: "t", sessions: [] }),
  });
  assert.equal(res.status, 400);

  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

test("GET /v1/batches/:id returns status", async () => {
  const { dir, store } = tempStore();
  store.add(record);
  const server = makeApp(store);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://127.0.0.1:${port}/v1/batches/b1`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.batchId, "b1");
  assert.equal(body.status, "received");
  assert.equal(body.sessions, 1);

  const missing = await fetch(`http://127.0.0.1:${port}/v1/batches/nope`);
  assert.equal(missing.status, 404);

  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});
