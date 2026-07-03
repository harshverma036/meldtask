import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env BEFORE any app imports — ESM hoists static imports above all code,
// so we must use dynamic import() to ensure env vars are populated first.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });
dotenv.config({ path: resolve(__dirname, "..", "..", "..", ".env") }); // root .env fallback

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`GOOGLE_CLIENT_ID configured: ${process.env.GOOGLE_CLIENT_ID ? "yes" : "NO — check your .env file"}`);
  console.log(`DATABASE_URL configured: ${process.env.DATABASE_URL ? "yes" : "NO — check your .env file"}`);
});
