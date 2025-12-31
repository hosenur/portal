import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_DIR = resolve(__dirname, "..");
const PACKAGE_JSON_PATH = resolve(CLI_DIR, "package.json");

type BumpType = "patch" | "minor" | "major";

function parseArgs(): { bumpType: BumpType; dryRun: boolean } {
  const args = process.argv.slice(2);
  let bumpType: BumpType = "patch";
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--dry-run" || arg === "-d") {
      dryRun = true;
    } else if (arg === "patch" || arg === "minor" || arg === "major") {
      bumpType = arg;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npx tsx scripts/publish.ts [bump-type] [options]

Bump Types:
  patch   Bump patch version (0.0.x) - default
  minor   Bump minor version (0.x.0)
  major   Bump major version (x.0.0)

Options:
  -d, --dry-run   Show what would happen without making changes
  -h, --help      Show this help message

Examples:
  npx tsx scripts/publish.ts           # Bump patch and publish
  npx tsx scripts/publish.ts minor     # Bump minor and publish
  npx tsx scripts/publish.ts --dry-run # Preview patch bump
`);
      process.exit(0);
    }
  }

  return { bumpType, dryRun };
}

function bumpVersion(version: string, type: BumpType): string {
  const [major, minor, patch] = version.split(".").map(Number);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function run(command: string, dryRun: boolean): void {
  console.log(`$ ${command}`);
  if (!dryRun) {
    execSync(command, { cwd: CLI_DIR, stdio: "inherit" });
  }
}

async function publish(): Promise<void> {
  const { bumpType, dryRun } = parseArgs();

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  const currentVersion = packageJson.version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`📦 Package: ${packageJson.name}`);
  console.log(
    `📊 Version bump: ${currentVersion} → ${newVersion} (${bumpType})\n`,
  );

  console.log("1. Updating package.json version...");
  packageJson.version = newVersion;
  if (!dryRun) {
    writeFileSync(
      PACKAGE_JSON_PATH,
      JSON.stringify(packageJson, null, 2) + "\n",
    );
  }
  console.log(`   ✓ Version updated to ${newVersion}\n`);

  console.log("2. Building package...");
  run("npm run build", dryRun);
  console.log("   ✓ Build complete\n");

  console.log("3. Publishing to npm...");
  run("npm publish --access public", dryRun);
  console.log("   ✓ Published to npm\n");

  console.log("4. Creating git tag...");
  run(`git add package.json`, dryRun);
  run(`git commit -m "chore(cli): release v${newVersion}"`, dryRun);
  run(`git tag -a cli-v${newVersion} -m "Release cli v${newVersion}"`, dryRun);
  console.log(`   ✓ Created tag cli-v${newVersion}\n`);

  console.log("═".repeat(50));
  console.log(`✅ Successfully published ${packageJson.name}@${newVersion}`);
  console.log("═".repeat(50));
  console.log("\nNext steps:");
  console.log("  git push && git push --tags");
}

publish().catch((err) => {
  console.error("\n❌ Publish failed:", err.message);
  process.exit(1);
});
