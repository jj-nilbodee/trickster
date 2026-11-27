import { defineConfig } from "vitest/config";

// Own config so vitest doesn't pick up the guide site's postcss.config.mjs in the repo root
export default defineConfig({ css: { postcss: {} }, test: { include: ["tests/**/*.test.ts"] } });
