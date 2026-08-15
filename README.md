# iolit-api

The Iolit marketplace API. Receives approved session-metadata batches from the
[iolit-client](https://github.com/Emad-log/iolit-client).

## Endpoints

- `POST /v1/batches`: submit a batch (schema must match the client exactly)
- `GET /v1/batches/:id`: status lookup
- `GET /health`

## What the API does with a batch

1. Validates it against the exact client schema. Unknown fields are rejected.
2. Stores it as a JSONL record (append-only, indexed by batch id).
3. Returns an honest earnings estimate (label: estimate, real pricing comes
   with real buyers).

## Run

```sh
npm install
npm run build
PORT=8092 DATA_DIR=/opt/iolit-api node dist/main.js
```

## Test

```sh
npm test
```

## License

MIT
