// The API. Three routes: health, submit batch, batch status.
// Kept as a factory so tests can run it without binding a port.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Store } from "./store.js";
import { parseBatch } from "./validate.js";
import { estimateUsd } from "./pricing.js";
import type { BatchRecord } from "./types.js";

export function makeApp(store: Store) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/batches") {
      const body = await readBody(req);
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
        estEarningsUsd: estimateUsd(parsed.value.sessions),
      };
      store.add(record);
      json(res, 201, {
        batchId: record.batchId,
        status: record.status,
        estEarningsUsd: record.estEarningsUsd,
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
        sessions: record.sessions.length,
      });
      return;
    }

    json(res, 404, { error: "not found" });
  });
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
