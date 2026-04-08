import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

fs.mkdirSync(dataDir, { recursive: true });

const port = Number(process.env.PORT || 3000);
const db = createDatabase(path.join(dataDir, "apartments.db"));
const app = createApp({ db });

app.listen(port, () => {
  console.log(`Apartment Compare running at http://127.0.0.1:${port}`);
});
