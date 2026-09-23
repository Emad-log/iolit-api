import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RateLimiter } from "../rate-limit.js";
import { Store } from "../store.js";
import { makeApp } from "../server.js";

test("allows up to the limit, then denies with a retry hint", () => {
  const limiter = new RateLimiter(3, 60_000);
  assert.equal(limiter.allow("a").ok, true);
  assert.equal(limiter.allow("a").ok, true);
  assert.equal(limiter.allow("a").ok, true);
  const denied = limiter.allow("a");
  assert.equal(denied.ok, false);
  assert.ok(denied.ok === false && denied.retryAfterSec >= 1);
  // Other keys are unaffected.
  assert.equal(limiter.allow("b").ok, true);
});

test("window expiry frees the key again", async () => {
  const limiter = new RateLimiter(1, 50);
  assert.equal(limiter.allow("a").ok, true);
  assert.equal(limiter.allow("a").ok, false);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(limiter.allow("a").ok, true);
});

test("POST /v1/batches returns 429 with Retry-After when over the limit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "iolit-rl-"));
  const store = new Store(dir);
  const server = makeApp(store);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;

  // Keep sending invalid batches until the limiter trips; invalid payloads
  // still count as hits, which is what we want (junk costs the sender).
  let saw429 = false;
  let retryAfter: string | null = null;
  for (let i = 0; i < 100 && !saw429; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/v1/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await res.text();
    if (res.status === 429) {
      saw429 = true;
      retryAfter = res.headers.get("retry-after");
    }
  }
  assert.equal(saw429, true);
  assert.ok(retryAfter && Number(retryAfter) >= 1);

  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});
