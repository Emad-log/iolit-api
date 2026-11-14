# iolit-api

[![CI](https://github.com/Emad-log/iolit-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Emad-log/iolit-api/actions/workflows/ci.yml)

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
- `IOLIT_API_KEY`: when set, `POST /v1/batches` requires
  `Authorization: Bearer <key>` (constant-time compare); unset by default
  so existing clients keep working, GETs stay public

## Test

Node 20 or newer. No runtime dependencies.

```sh
npm run build
npm test        # runs against dist/
npm run check   # both
```

## Layout

```
src/
  main.ts         reads the environment, starts the server
  server.ts       routes, body limits, API key check
  validate.ts     strict schema validation of a batch
  provenance.ts   commit SHA checks and duplicate detection
  rate-limit.ts   per-IP limits
  pricing.ts      the earnings estimate
  store.ts        append-only JSONL storage
  types.ts        the wire schema, shared with iolit-client
  test/           unit and API tests
```

## Status

Shelved. Iolit was a waitlist for an idea that did not take off. The code
stays here, building and tested, for anyone who wants to read it.

## License

[MIT](LICENSE)
