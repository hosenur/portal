import { $ } from "bun";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";

const CLI_DIR = resolve(import.meta.dirname, "..");
const APPS_WEB_DIR = resolve(CLI_DIR, "..", "..", "apps", "web");
const WEB_OUTPUT_DIR = resolve(CLI_DIR, "web");

const DEV_ONLY_PACKAGES = [
  "typescript",
  "@types",
  "@img",
  "sharp",
  "@next/swc",
  "eslint",
  "prettier",
  "biome",
  "@biomejs",
  "@swc",
  "turbo",
];

function removeDevPackages(nodeModulesDir: string): void {
  const bunDir = join(nodeModulesDir, ".bun");
  if (!existsSync(bunDir)) return;

  const entries = readdirSync(bunDir);
  let removedCount = 0;

  for (const entry of entries) {
    const isDevPackage = DEV_ONLY_PACKAGES.some(
      (pkg) => entry.startsWith(pkg + "@") || entry.startsWith(pkg + "+"),
    );

    if (isDevPackage) {
      const fullPath = join(bunDir, entry);
      try {
        rmSync(fullPath, { recursive: true });
        removedCount++;
      } catch {}
    }
  }

  console.log(`   ✓ Removed ${removedCount} dev-only packages`);
}

function removeSourceMaps(dir: string): void {
  const walk = (currentDir: string) => {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".map") || entry.name.endsWith(".d.ts")) {
        try {
          rmSync(fullPath);
        } catch {}
      }
    }
  };

  walk(dir);
  console.log("   ✓ Removed source maps and type definitions");
}

async function build(): Promise<void> {
  console.log("Building OpenPortal CLI...\n");

  console.log("1. Compiling TypeScript...");
  await $`bun tsc`.cwd(CLI_DIR);
  console.log("   ✓ TypeScript compiled\n");

  console.log("2. Building Next.js web app...");
  await $`bun run build`.cwd(APPS_WEB_DIR);
  console.log("   ✓ Next.js built\n");

  console.log("3. Copying standalone output...");
  const standaloneSrc = resolve(APPS_WEB_DIR, ".next", "standalone");
  const staticSrc = resolve(APPS_WEB_DIR, ".next", "static");
  const publicSrc = resolve(APPS_WEB_DIR, "public");

  if (!existsSync(standaloneSrc)) {
    throw new Error(
      "Next.js standalone output not found. Make sure output: 'standalone' is set in next.config.ts",
    );
  }

  if (existsSync(WEB_OUTPUT_DIR)) {
    rmSync(WEB_OUTPUT_DIR, { recursive: true });
  }
  mkdirSync(WEB_OUTPUT_DIR, { recursive: true });

  cpSync(standaloneSrc, WEB_OUTPUT_DIR, { recursive: true });

  const webStaticDest = resolve(WEB_OUTPUT_DIR, ".next", "static");
  mkdirSync(resolve(WEB_OUTPUT_DIR, ".next"), { recursive: true });
  cpSync(staticSrc, webStaticDest, { recursive: true });

  if (existsSync(publicSrc)) {
    const publicDest = resolve(WEB_OUTPUT_DIR, "public");
    cpSync(publicSrc, publicDest, { recursive: true });
  }

  console.log("   ✓ Standalone output copied\n");

  console.log("4. Optimizing bundle size...");
  const nodeModulesDir = resolve(WEB_OUTPUT_DIR, "node_modules");
  removeDevPackages(nodeModulesDir);
  removeSourceMaps(nodeModulesDir);
  console.log("");

  const { stdout } = await $`du -sh ${WEB_OUTPUT_DIR}`.quiet();
  const size = stdout.toString().trim().split("\t")[0];

  console.log("Build complete!\n");
  console.log("Package contents:");
  console.log("   - bin/openportal.js (CLI entry point)");
  console.log("   - dist/ (compiled TypeScript)");
  console.log(`   - web/ (Next.js standalone app, ${size})`);
}

build().catch((err) => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
