import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // `server-only` throws outside a Next.js server build; tests run in plain Node.
    alias: { "server-only": fileURLToPath(new URL("./src/server/__fixtures__/empty.ts", import.meta.url)) },
  },
});
