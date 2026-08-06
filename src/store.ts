// JSONL batch store. Append-only, one record per line, indexed by id.
// Simple by design: read the file for lookups, no deps.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BatchRecord } from "./types.js";

export class Store {
  private file: string;

  constructor(dataDir: string, private index = new Map<string, BatchRecord>()) {
    mkdirSync(dataDir, { recursive: true });
    this.file = join(dataDir, "batches.jsonl");
    if (existsSync(this.file)) this.load();
  }

  private load() {
    for (const line of readFileSync(this.file, "utf8").split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line) as BatchRecord;
        this.index.set(r.batchId, r);
      } catch {
        // skip corrupt line
      }
    }
  }

  add(record: BatchRecord) {
    this.index.set(record.batchId, record);
    appendFileSync(this.file, JSON.stringify(record) + "\n");
  }

  get(id: string): BatchRecord | undefined {
    return this.index.get(id);
  }

  count(): number {
    return this.index.size;
  }
}
