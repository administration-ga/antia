import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "social-contracts",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
