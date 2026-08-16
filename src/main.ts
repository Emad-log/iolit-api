import { mkdirSync } from "node:fs";
import { makeApp } from "./server.js";
import { Store } from "./store.js";

const port = Number(process.env.PORT ?? 8092);
const dataDir = process.env.DATA_DIR ?? "/opt/iolit-api";
mkdirSync(dataDir, { recursive: true });

const store = new Store(dataDir);
makeApp(store).listen(port, () => {
  console.log(`iolit-api listening on :${port} (${store.count()} batches)`);
});
