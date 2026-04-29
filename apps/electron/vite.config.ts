import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

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
    vue(),
    vueJsx(),
    electron({
      main: {
        entry: resolve(appRoot, "src/main/index.ts"),
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
          build: {
            outDir: resolve(appRoot, "out/main"),
            emptyOutDir: true,
            rolldownOptions: {
              external: ["@libsql/client"],
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
