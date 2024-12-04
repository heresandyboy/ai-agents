import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: {
    index: "src/index.ts",
    "agents/index": "src/agents/index.ts",
    "llm/index": "src/llm/index.ts",
    "tools/index": "src/tools/index.ts",
    "types/index": "src/types/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  treeshake: !options.watch,
  minify: !options.watch,
  watch: options.watch,
  external: [
    "@portkey-ai/vercel-provider",
    "ai",
    "debug",
    "dotenv",
    "openai",
    "portkey-ai",
    "zod",
  ],
  onSuccess: options.watch
    ? "echo '🚀 Build successful, watching for changes...'"
    : "echo '✅ Build completed successfully!'",
}));
