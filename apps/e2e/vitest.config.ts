import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/tests/**/*.spec.ts"],
    hookTimeout: 30_000,
    testTimeout: 45_000,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
