import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 60_000,
    include: ["test/smoke/**/*.smoke.ts"],
    testTimeout: 240_000,
  },
});
