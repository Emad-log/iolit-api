# iolit-api

The Iolit marketplace API. Receives approved session-metadata batches from the
[iolit-client](https://github.com/Emad-log/iolit-client).

## Endpoints

- `POST /v1/batches`: submit a batch (schema must match the client exactly)
- `GET /v1/batches/:id`: status lookup
- `GET /health`

## What the API does with a batch

1. Validates it against the exact client schema. Unknown fields are rejected.
   Counters must be non-negative (negatives would corrupt the estimate),
   `hourOfDay`/`dayOfWeek` must be in range, and free-text previews are
   scanned for high-confidence credential shapes (AWS keys, private keys,
   GitHub/Slack/Anthropic tokens) and rejected rather than stored.
2. Verifies provenance: commit SHAs must be well-formed, and any SHA
   already seen in another batch is flagged as a duplicate (the signature
   of copied or farmed sessions). Batches with no commits are stored as
   honestly unverified, not rejected.
3. Stores it as a JSONL record (append-only, indexed by batch id).
4. Returns an honest earnings estimate (label: estimate, real pricing comes
   with real buyers), plus the verification result.

## Run

```sh
npm install
npm run build
PORT=8092 DATA_DIR=/opt/iolit-api node dist/main.js
```

Environment knobs:

- `MAX_BODY_BYTES` (default 10485760): request body cap, 413 past it
- `MAX_SESSIONS` (default 5000): sessions per batch cap, 413 past it
- `RATE_LIMIT_POST_PER_MIN` (default 30): per-IP POST ingest limit, 429 past it
- `RATE_LIMIT_GET_PER_MIN` (default 300): per-IP batch lookup limit, 429 past it

## Test

```sh
npm test
```

## License

MIT
