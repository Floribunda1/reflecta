import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/server/src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.REFLECTA_DB_PATH ?? "/tmp/reflecta-dev.db",
  },
});
