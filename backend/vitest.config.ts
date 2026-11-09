import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Las integraciones comparten una sola base de datos de pruebas
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
