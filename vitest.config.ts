import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals:     true,
    setupFiles:  ["./vitest.setup.ts"],
    include:     ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    exclude:     ["node_modules", ".next"],
    coverage: {
      provider:  "v8",
      reporter:  ["text", "lcov"],
      include:   ["app/lib/**", "app/api/**", "components/**"],
      exclude:   ["node_modules", ".next"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
