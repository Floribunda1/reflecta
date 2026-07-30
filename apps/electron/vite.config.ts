import { fileURLToPath } from "node:url";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

const mainExternals = [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-ai/bun-oauth",
  "@earendil-works/pi-ai/compat",
  "@earendil-works/pi-coding-agent",
  "@lancedb/lancedb",
  "better-sqlite3",
  "libsql",
  "node-llama-cpp",
];

const esmOutput = {
  format: "es" as const,
  entryFileNames: "[name].mjs",
  chunkFileNames: "[name].mjs",
  codeSplitting: false,
};

const mainOutput = {
  format: "es" as const,
  entryFileNames: "[name].js",
  chunkFileNames: "[name].js",
  codeSplitting: true,
};

const copyMainMigrationSql = () => ({
  name: "copy-main-migration-sql",
  closeBundle() {
    cpSync(
      resolve(appRoot, "../../packages/server/src/db/migration/sql"),
      resolve(appRoot, "out/main/migration/sql"),
      { recursive: true },
    );
  },
});

export default defineConfig({
  root: resolve(appRoot, "src/renderer"),
  publicDir: false,
  resolve: {
    alias: {
      "@renderer": resolve(appRoot, "src/renderer/src"),
      "@shared": resolve(appRoot, "src/preload/typings"),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        entry: {
          index: resolve(appRoot, "src/main/index.ts"),
          "retrieval-embedding-worker": resolve(appRoot, "src/main/retrieval-embedding-worker.ts"),
        },
        onstart({ startup }) {
          void startup(undefined, { cwd: appRoot });
        },
        vite: {
          root: appRoot,
          resolve: {
            alias: {
              "@main": resolve(appRoot, "src/main"),
              "@shared": resolve(appRoot, "src/preload/typings"),
            },
          },
          plugins: [copyMainMigrationSql()],
          build: {
            outDir: resolve(appRoot, "out/main"),
            emptyOutDir: true,
            rolldownOptions: {
              external: mainExternals,
              output: mainOutput,
            },
          },
        },
      },
      preload: {
        input: resolve(appRoot, "src/preload/index.ts"),
        vite: {
          root: appRoot,
          resolve: {
            alias: {
              "@shared": resolve(appRoot, "src/preload/typings"),
            },
          },
          build: {
            outDir: resolve(appRoot, "out/preload"),
            emptyOutDir: true,
            rolldownOptions: {
              output: esmOutput,
            },
          },
        },
      },
    }),
  ],
  build: {
    outDir: resolve(appRoot, "out/renderer"),
    emptyOutDir: true,
  },
});
