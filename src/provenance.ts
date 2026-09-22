// Provenance verification on ingest.
//
// The client binds each session to the git commits made during its
// window (SHAs only, no repo identity). The API cannot check those SHAs
// against GitHub without knowing the repo, so verification here means:
//   1. SHAs are well-formed (enforced by validate.ts).
//   2. No SHA appears in another seller's batch. Reused SHAs across
//      batches is the signature of copied or farmed sessions.
//
// verified = at least one commit was checked and none were duplicates.
// A batch with no commits is stored honestly as unverified, not rejected.

import type { BatchPayload, BatchRecord, Verification } from "./types.js";
import type { Store } from "./store.js";

export function verifyProvenance(batch: BatchPayload, store: Store): Verification {
  const commits = new Set<string>();
  for (const s of batch.sessions) {
    const prov = (s as { provenance?: { commits?: unknown } }).provenance;
    if (prov && Array.isArray(prov.commits)) {
      for (const c of prov.commits) {
        if (typeof c === "string") commits.add(c);
      }
    }
  }

  const seenElsewhere = new Set<string>();
  for (const record of store.all()) {
    if (record.batchId === batch.batchId) continue;
    for (const s of record.sessions) {
      const prov = (s as { provenance?: { commits?: unknown } }).provenance;
      if (prov && Array.isArray(prov.commits)) {
        for (const c of prov.commits) {
          if (typeof c === "string" && commits.has(c)) seenElsewhere.add(c);
        }
      }
    }
  }

  const duplicateCommits = Array.from(seenElsewhere).sort();
  return {
    commitsChecked: commits.size,
    duplicateCommits,
    verified: commits.size > 0 && duplicateCommits.length === 0,
  };
}

/** Re-verify a stored record (e.g. after new batches arrive). */
export function reverifyRecord(record: BatchRecord, store: Store): Verification {
  return verifyProvenance(record, store);
}
