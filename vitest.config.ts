import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // Testcontainers 기반 통합 테스트 (Docker 필요)
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 120_000,
          hookTimeout: 300_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
