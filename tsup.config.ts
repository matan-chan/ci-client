import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  noExternal: ["chalk", "commander", "glob"],
  clean: true,
});
