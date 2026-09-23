import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../store.js";
import { makeApp } from "../server.js";

async function post(port: number, headers: Record<string, string>) {
  const res = await fetch(`http://127.0.0.1:${port}/v1/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: "{}",
  });
  await res.text();
  return res.status;
}

test("POST is open when IOLIT_API_KEY is unset", async () => {
  delete process.env.IOLIT_API_KEY;
  const dir = mkdtempSync(join(tmpdir(), "iolit-key-"));
  const server = makeApp(new Store(dir));
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;

  // "{}" fails schema validation, which proves we got past auth (400 not 401).
  assert.equal(await post(port, {}), 400);

  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

test("POST requires the bearer key when IOLIT_API_KEY is set", async () => {
  process.env.IOLIT_API_KEY = "test-key-123";
  try {
    const dir = mkdtempSync(join(tmpdir(), "iolit-key-"));
    const server = makeApp(new Store(dir));
    await new Promise<void>((r) => server.listen(0, () => r()));
    const port = (server.address() as { port: number }).port;

    assert.equal(await post(port, {}), 401);
    assert.equal(await post(port, { Authorization: "Bearer wrong-key" }), 401);
    assert.equal(await post(port, { Authorization: "Token test-key-123" }), 401);
    // Correct key passes auth and reaches validation (400 for the bad body).
    assert.equal(await post(port, { Authorization: "Bearer test-key-123" }), 400);

    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  } finally {
    delete process.env.IOLIT_API_KEY;
  }
});
