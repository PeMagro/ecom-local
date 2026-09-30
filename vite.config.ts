// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Default preset is Cloudflare Workers, which has no node:sqlite/node:fs — the local
  // SQLite backend needs a real Node process, so pin the build target explicitly.
  nitro: { preset: "node-server" },
  // HTTPS with an auto-generated, auto-trusted self-signed cert — needed because the
  // Mercado Livre OAuth app has https://127.0.0.1:8080 registered as its redirect_uri.
  plugins: [basicSsl()],
});
