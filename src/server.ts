// Factory so tests can run without binding a port.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Store } from "./store.js";
import { parseBatch } from "./validate.js";
import { estimateUsd } from "./pricing.js";
import { verifyProvenance } from "./provenance.js";
import { RateLimiter } from "./rate-limit.js";
import type { BatchRecord } from "./types.js";

const MIN = 60 * 1000;
const postLimiter = new RateLimiter(Number(process.env.RATE_LIMIT_POST_PER_MIN ?? 30), MIN);
const getLimiter = new RateLimiter(Number(process.env.RATE_LIMIT_GET_PER_MIN ?? 300), MIN);

export function makeApp(store: Store) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    const client = req.socket.remoteAddress ?? "unknown";

    if (req.method === "POST" && url.pathname === "/v1/batches") {
      const limit = postLimiter.allow(client);
      if (!limit.ok) {
        res.setHeader("Retry-After", String(limit.retryAfterSec));
        json(res, 429, { error: "rate limited" });
        return;
      }
    } else if (req.method === "GET" && url.pathname.startsWith("/v1/batches/")) {
      const limit = getLimiter.allow(client);
      if (!limit.ok) {
        res.setHeader("Retry-After", String(limit.retryAfterSec));
        json(res, 429, { error: "rate limited" });
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/batches") {
      // Optional shared secret. Unset by default so existing clients keep
      // working; set IOLIT_API_KEY to lock ingest down. Read per request so
      // tests (and key rotation) do not need a restart.
      if (!authorized(req)) {
        json(res, 401, { error: "unauthorized" });
        return;
      }
      const body = await readBody(req);
      if (body === null) {
        json(res, 400, { error: "invalid json" });
        return;
      }
      const parsed = parseBatch(body);
      if (!parsed.ok) {
        json(res, 400, { error: parsed.error });
        return;
      }

      if (store.get(parsed.value.batchId)) {
        json(res, 409, { error: "batch already exists" });
        return;
      }

      const record: BatchRecord = {
        ...parsed.value,
        status: "received",
        receivedAt: new Date().toISOString(),
        estEarningsUsd: estimateUsd(parsed.value.sessions, parsed.value.shareTier),
        verification: verifyProvenance(parsed.value, store),
      };
      store.add(record);
      json(res, 201, {
        batchId: record.batchId,
        status: record.status,
        estEarningsUsd: record.estEarningsUsd,
        verification: record.verification,
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/batches/")) {
      const id = url.pathname.slice("/v1/batches/".length);
      const record = store.get(id);
      if (!record) {
        json(res, 404, { error: "batch not found" });
        return;
      }
      json(res, 200, {
        batchId: record.batchId,
        status: record.status,
        receivedAt: record.receivedAt,
        estEarningsUsd: record.estEarningsUsd,
        verification: record.verification,
        sessions: record.sessions.length,
      });
      return;
    }

    json(res, 404, { error: "not found" });
  });
}

function readBody(req: IncomingMessage): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  const key = process.env.IOLIT_API_KEY ?? "";
  if (!key) return true; // open by default, keeps existing clients working
  const header = req.headers.authorization ?? "";
  const space = header.indexOf(" ");
  if (space < 0 || header.slice(0, space) !== "Bearer") return false;
  const token = Buffer.from(header.slice(space + 1));
  const expected = Buffer.from(key);
  return token.length === expected.length && timingSafeEqual(token, expected);
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
