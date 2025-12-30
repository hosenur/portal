#!/usr/bin/env node

import { Command } from "commander";
import { resolve, dirname } from "node:path";
import { cwd } from "node:process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  log,
  logSuccess,
  logError,
  logInfo,
  setupShutdownHandlers,
  killAllProcesses,
  openBrowser,
  isPortAvailable,
  colors,
} from "./utils.js";
import {
  checkOpencodeInstalled,
  startOpencodeServer,
  stopOpencodeServer,
  printInstallInstructions,
} from "./opencode.js";
import { startWebServer, stopWebServer } from "./server.js";
import type { ChildProcess } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
);
const version = packageJson.version;

interface CLIOptions {
  port: string;
  opencodePort: string;
  directory: string;
  noBrowser: boolean;
  skipOpencodeCheck: boolean;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("openportal")
    .description("OpenCode Portal - Web UI for OpenCode AI coding agent")
    .version(version)
    .option("-p, --port <port>", "Port for web UI", "3000")
    .option("--opencode-port <port>", "Port for OpenCode server", "4000")
    .option("-d, --directory <path>", "Working directory for OpenCode", cwd())
    .option("--no-browser", "Do not open browser automatically")
    .option("--skip-opencode-check", "Skip OpenCode installation check")
    .action(async (options: CLIOptions) => {
      await runPortal(options);
    });

  await program.parseAsync(process.argv);
}

async function runPortal(options: CLIOptions): Promise<void> {
  console.log("");
  console.log(
    `${colors.bold}${colors.cyan}  OpenCode Portal${colors.reset} ${colors.dim}v${version}${colors.reset}`,
  );
  console.log("");

  const webPort = parseInt(options.port, 10);
  const opencodePort = parseInt(options.opencodePort, 10);
  const directory = resolve(options.directory);

  if (isNaN(webPort) || webPort < 1 || webPort > 65535) {
    logError(`Invalid web port: ${options.port}`);
    process.exit(1);
  }

  if (isNaN(opencodePort) || opencodePort < 1 || opencodePort > 65535) {
    logError(`Invalid OpenCode port: ${options.opencodePort}`);
    process.exit(1);
  }

  if (!options.skipOpencodeCheck) {
    const opencodeVersion = await checkOpencodeInstalled();
    if (!opencodeVersion) {
      printInstallInstructions();
      process.exit(1);
    }
    logSuccess(`OpenCode detected: ${opencodeVersion}`);
  }

  const webPortAvailable = await isPortAvailable(webPort);
  if (!webPortAvailable) {
    logError(`Port ${webPort} is already in use`);
    process.exit(1);
  }

  const opencodePortAvailable = await isPortAvailable(opencodePort);
  if (!opencodePortAvailable) {
    logError(`Port ${opencodePort} is already in use`);
    process.exit(1);
  }

  let opencodeProc: ChildProcess | null = null;
  let webProc: ChildProcess | null = null;

  const cleanup = () => {
    if (webProc) stopWebServer(webProc);
    if (opencodeProc) stopOpencodeServer(opencodeProc);
  };

  setupShutdownHandlers(cleanup);

  logInfo(`Working directory: ${directory}`);

  opencodeProc = await startOpencodeServer({
    port: opencodePort,
    directory,
    hostname: "127.0.0.1",
  });

  if (!opencodeProc) {
    logError("Failed to start OpenCode server");
    process.exit(1);
  }

  webProc = await startWebServer({
    port: webPort,
    opencodePort,
    opencodeHost: "127.0.0.1",
  });

  if (!webProc) {
    logError("Failed to start web server");
    cleanup();
    process.exit(1);
  }

  const portalUrl = `http://localhost:${webPort}`;
  console.log("");
  console.log(`${colors.bold}${colors.green}  Portal is ready!${colors.reset}`);
  console.log("");
  console.log(`  ${colors.dim}Web UI:${colors.reset}    ${portalUrl}`);
  console.log(
    `  ${colors.dim}OpenCode:${colors.reset}  http://localhost:${opencodePort}`,
  );
  console.log(`  ${colors.dim}Directory:${colors.reset} ${directory}`);
  console.log("");
  console.log(`  ${colors.dim}Press Ctrl+C to stop${colors.reset}`);
  console.log("");

  if (!options.noBrowser) {
    await openBrowser(portalUrl);
  }

  await new Promise<void>((resolve) => {
    const checkProcesses = setInterval(() => {
      if (
        (opencodeProc && opencodeProc.killed) ||
        (webProc && webProc.killed)
      ) {
        clearInterval(checkProcesses);
        cleanup();
        resolve();
      }
    }, 1000);
  });
}

main().catch((err) => {
  logError(err.message);
  killAllProcesses();
  process.exit(1);
});
