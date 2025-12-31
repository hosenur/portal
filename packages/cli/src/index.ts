#!/usr/bin/env bun

import { $ } from "bun";
import { Command } from "commander";
import { getPort } from "get-port-please";

const OPENCODE_IMAGE = "ghcr.io/sst/opencode:1.0.218";
const OPENCODE_CONTAINER_PORT = 4096;

const program = new Command()
  .name("portal")
  .description("CLI to run OpenCode containers")
  .version("0.1.0");

program
  .command("run")
  .description("Run an OpenCode container mounting the current directory")
  .option("-d, --directory <path>", "Directory to mount", process.cwd())
  .option("--name <name>", "Container name", "opencode")
  .option("--detach", "Run container in background", false)
  .action(async (options) => {
    const { directory, name, detach } = options;
    const resolvedDir = Bun.fileURLToPath(
      new URL(directory, `file://${process.cwd()}/`),
    );
    const containerDir = resolvedDir;
    const mountSpec = `${resolvedDir}:${containerDir}`;
    const hostPort = await getPort();

    console.log(`Starting OpenCode container...`);
    console.log(`  Image: ${OPENCODE_IMAGE}`);
    console.log(`  Mount: ${resolvedDir} -> ${containerDir}`);
    console.log(`  Workdir: ${containerDir}`);
    console.log(`  Port: ${hostPort}:${OPENCODE_CONTAINER_PORT}`);

    const detachArgs = detach ? ["-d"] : [];

    try {
      const existing = await $`docker ps -aq -f name=${name}`.text();
      if (existing.trim()) {
        console.log(`Removing existing container: ${name}`);
        await $`docker rm -f ${name}`.quiet();
      }

      if (detach) {
        await $`docker run ${detachArgs} --name ${name} -p ${hostPort}:${OPENCODE_CONTAINER_PORT} -v ${mountSpec} -w ${containerDir} ${OPENCODE_IMAGE} serve`;
        console.log(`\nContainer started in background.`);
        console.log(`Access OpenCode at http://localhost:${hostPort}`);
      } else {
        await $`docker run --name ${name} --rm -it -p ${hostPort}:${OPENCODE_CONTAINER_PORT} -v ${mountSpec} -w ${containerDir} ${OPENCODE_IMAGE} serve`;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to start container: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command("stop")
  .description("Stop a running OpenCode container")
  .option("--name <name>", "Container name", "opencode")
  .action(async (options) => {
    const { name } = options;

    try {
      console.log(`Stopping container: ${name}`);
      await $`docker stop ${name}`;
      await $`docker rm ${name}`.quiet().nothrow();
      console.log(`Container stopped.`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to stop container: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command("list")
  .alias("ls")
  .description("List running OpenCode containers")
  .action(async () => {
    try {
      await $`docker ps --filter "ancestor=${OPENCODE_IMAGE}" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"`;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to list containers: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command("pull")
  .description("Pull the latest OpenCode image")
  .action(async () => {
    try {
      console.log(`Pulling ${OPENCODE_IMAGE}...`);
      await $`docker pull ${OPENCODE_IMAGE}`;
      console.log(`Image pulled successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to pull image: ${error.message}`);
      }
      process.exit(1);
    }
  });

program.parse();
