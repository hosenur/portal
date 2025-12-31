import { execSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_DIR = resolve(__dirname, "..");
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
  "turbo",
];

function run(command: string, cwd: string): void {
  execSync(command, { cwd, stdio: "inherit" });
}

function removeDevPackages(nodeModulesDir: string): void {
  if (!existsSync(nodeModulesDir)) return;

  const entries = readdirSync(nodeModulesDir);
  let removedCount = 0;

  for (const entry of entries) {
    const isDevPackage = DEV_ONLY_PACKAGES.some(
      (pkg) =>
        entry === pkg ||
        entry.startsWith(pkg + "-") ||
        (entry.startsWith("@") && entry.includes(pkg)),
    );

    if (isDevPackage) {
      const fullPath = join(nodeModulesDir, entry);
      try {
        rmSync(fullPath, { recursive: true });
        removedCount++;
      } catch {}
    }
  }

  const scopedDirs = entries.filter((e) => e.startsWith("@"));
  for (const scopedDir of scopedDirs) {
    const scopedPath = join(nodeModulesDir, scopedDir);
    if (!existsSync(scopedPath)) continue;

    const scopedEntries = readdirSync(scopedPath);
    for (const entry of scopedEntries) {
      const isDevPackage = DEV_ONLY_PACKAGES.some((pkg) => entry.includes(pkg));
      if (isDevPackage) {
        const fullPath = join(scopedPath, entry);
        try {
          rmSync(fullPath, { recursive: true });
          removedCount++;
        } catch {}
      }
    }

    try {
      const remaining = readdirSync(scopedPath);
      if (remaining.length === 0) {
        rmSync(scopedPath, { recursive: true });
      }
    } catch {}
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

function getDirectorySize(dir: string): string {
  try {
    const output = execSync(`du -sh "${dir}"`, { encoding: "utf-8" });
    return output.trim().split("\t")[0];
  } catch {
    return "unknown";
  }
}

async function build(): Promise<void> {
  console.log("Building OpenPortal CLI...\n");

  console.log("1. Compiling TypeScript...");
  run("npx tsc", CLI_DIR);
  console.log("   ✓ TypeScript compiled\n");

  console.log("2. Building Next.js web app...");
  run("npm run build", APPS_WEB_DIR);
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

  const appWebDir = resolve(WEB_OUTPUT_DIR, "apps", "web");
  const appStaticDest = resolve(appWebDir, ".next", "static");
  mkdirSync(appStaticDest, { recursive: true });
  cpSync(staticSrc, appStaticDest, { recursive: true });

  if (existsSync(publicSrc)) {
    const publicDest = resolve(appWebDir, "public");
    cpSync(publicSrc, publicDest, { recursive: true });
  }

  console.log("   ✓ Standalone output copied\n");

  console.log("4. Optimizing bundle size...");
  const nodeModulesDir = resolve(WEB_OUTPUT_DIR, "node_modules");
  removeDevPackages(nodeModulesDir);
  removeSourceMaps(nodeModulesDir);
  console.log("");

  console.log(
    "5. Renaming node_modules to _modules (npm ignores node_modules)...",
  );
  const renamedModulesDir = resolve(WEB_OUTPUT_DIR, "_modules");
  const renameNodeModules = (
    sourceDir: string,
    targetDir: string,
    label: string,
  ): void => {
    if (!existsSync(sourceDir)) {
      console.log(`   ⚠ ${label} node_modules not found, skipping rename`);
      return;
    }
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true });
    }
    cpSync(sourceDir, targetDir, { recursive: true });
    rmSync(sourceDir, { recursive: true });
    console.log(`   ✓ Renamed ${label} node_modules to _modules`);
  };

  renameNodeModules(nodeModulesDir, renamedModulesDir, "root");

  const appNodeModulesDir = resolve(
    WEB_OUTPUT_DIR,
    "apps",
    "web",
    "node_modules",
  );
  const appRenamedModulesDir = resolve(
    WEB_OUTPUT_DIR,
    "apps",
    "web",
    "_modules",
  );
  renameNodeModules(appNodeModulesDir, appRenamedModulesDir, "apps/web");
  console.log("");

  const size = getDirectorySize(WEB_OUTPUT_DIR);

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
