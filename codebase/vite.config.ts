import vinext from "vinext";
import { defineConfig, type PluginOption } from "vite";
import fs from "node:fs";
import path from "node:path";

type SitesPluginModule = { sites?: () => PluginOption };

let hostingConfig: { d1?: string; r2?: string } = {};
if (fs.existsSync(path.resolve(".openai/hosting.json"))) {
  try {
    hostingConfig = JSON.parse(fs.readFileSync(path.resolve(".openai/hosting.json"), "utf-8"));
  } catch (e) {
    console.warn("Could not load .openai/hosting.json:", e);
  }
}

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  let sitesPlugin: PluginOption | null = null;
  if (fs.existsSync(path.resolve("build/sites-vite-plugin.ts")) || fs.existsSync(path.resolve("build/sites-vite-plugin.js"))) {
    try {
      const mod = (await import("./build/sites-vite-plugin")) as SitesPluginModule;
      sitesPlugin = typeof mod.sites === "function" ? mod.sites() : null;
    } catch (e) {
      console.warn("Could not load sites plugin:", e);
    }
  }

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sitesPlugin,
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ].filter(Boolean),
  };
});

