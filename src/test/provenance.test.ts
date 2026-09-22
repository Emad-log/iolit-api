import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../store.js";
import { verifyProvenance } from "../provenance.js";
import type { BatchPayload, SessionMeta } from "../types.js";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), "iolit-prov-"));
  return { dir, store: new Store(dir) };
}

function batch(batchId: string, commits: string[]): BatchPayload {
  const session = {
    tool: "claude",
    model: "m",
    modelsUsed: ["m"],
    startedAt: "2026-08-06T00:00:00Z",
    endedAt: "2026-08-06T00:02:00Z",
    durationSec: 120,
    hourOfDay: 0,
    dayOfWeek: 4,
    cliVersion: "1",
    userTurns: 1,
    assistantTurns: 1,
    tokensIn: 10,
    tokensOut: 10,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    cacheHitRatio: 0,
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
    textCharsOut: 0,
    userCharsIn: 0,
    isSubagent: false,
    cwdHash: "x",
    hasGit: true,
    branchClass: "main",
    provenance: { commits },
    langHints: ["ts"],
    permissionMode: "",
    stopReasons: [],
    shareTier: "pulse",
    toolEvents: [],
    userPromptPreview: "",
    assistantPreview: "",
    thinkingPreview: "",
  } as SessionMeta;
  return { version: 1, app: "iolit", batchId, createdAt: "2026-08-06T00:00:00Z", shareTier: "pulse", sessions: [session] };
}

function storedBatch(batchId: string, commits: string[]) {
  return {
    ...batch(batchId, commits),
    status: "received" as const,
    receivedAt: "2026-08-06T00:00:01Z",
    estEarningsUsd: 0.01,
    verification: { commitsChecked: commits.length, duplicateCommits: [] as string[], verified: true },
  };
}

test("verifyProvenance marks a batch verified when SHAs are fresh", () => {
  const { dir, store } = tempStore();
  try {
    const v = verifyProvenance(batch("b1", [SHA_A, SHA_B]), store);
    assert.equal(v.commitsChecked, 2);
    assert.deepEqual(v.duplicateCommits, []);
    assert.equal(v.verified, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProvenance flags SHAs already seen in another batch", () => {
  const { dir, store } = tempStore();
  try {
    store.add(storedBatch("b1", [SHA_A]));
    const v = verifyProvenance(batch("b2", [SHA_A, SHA_C]), store);
    assert.equal(v.commitsChecked, 2);
    assert.deepEqual(v.duplicateCommits, [SHA_A]);
    assert.equal(v.verified, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProvenance ignores the batch's own SHAs", () => {
  const { dir, store } = tempStore();
  try {
    store.add(storedBatch("b1", [SHA_A]));
    // Same batch re-checked (e.g. reverify) must not self-flag.
    const v = verifyProvenance(batch("b1", [SHA_A]), store);
    assert.deepEqual(v.duplicateCommits, []);
    assert.equal(v.verified, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProvenance leaves a commitless batch honestly unverified", () => {
  const { dir, store } = tempStore();
  try {
    const v = verifyProvenance(batch("b1", []), store);
    assert.equal(v.commitsChecked, 0);
    assert.equal(v.verified, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifyProvenance tolerates sessions without provenance (old clients)", () => {
  const { dir, store } = tempStore();
  try {
    const b = batch("b1", [SHA_A]);
    delete (b.sessions[0] as unknown as Record<string, unknown>).provenance;
    const v = verifyProvenance(b, store);
    assert.equal(v.commitsChecked, 0);
    assert.equal(v.verified, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
