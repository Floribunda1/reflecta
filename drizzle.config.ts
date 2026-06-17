import { defineConfig } from "drizzle-kit";

const dbPath = process.env.REFLECTA_DB_PATH;
if (!dbPath) {
  throw new Error("REFLECTA_DB_PATH is required.");
}

export default defineConfig({
  schema: "./packages/server/src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
