import Docker from "dockerode";

interface DockerConnectionOptions {
  socketPath?: string;
  host?: string;
  port?: number;
}

function parseDockerHostEnv(dockerHost: string): DockerConnectionOptions {
  if (dockerHost.startsWith("tcp://")) {
    const url = new URL(dockerHost);
    return { host: url.hostname, port: parseInt(url.port, 10) || 2375 };
  }

  if (dockerHost.startsWith("unix://")) {
    return { socketPath: dockerHost.replace("unix://", "") };
  }

  if (dockerHost.startsWith("npipe://")) {
    return { socketPath: dockerHost.replace("npipe://", "") };
  }

  return { socketPath: dockerHost };
}

function getPlatformDefaultSocket(): DockerConnectionOptions {
  if (process.platform === "win32") {
    return { socketPath: "//./pipe/docker_engine" };
  }
  return { socketPath: "/var/run/docker.sock" };
}

export function getDockerConnectionOptions(): DockerConnectionOptions {
  if (process.env.DOCKER_HOST) {
    return parseDockerHostEnv(process.env.DOCKER_HOST);
  }
  return getPlatformDefaultSocket();
}

export function createDockerClient(): Docker {
  return new Docker(getDockerConnectionOptions());
}

let dockerClient: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerClient) {
    dockerClient = createDockerClient();
  }
  return dockerClient;
}

export async function isContainerRunning(
  containerId: string | null,
): Promise<boolean> {
  if (!containerId) return false;

  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Running;
  } catch (error) {
    if (process.env.DEBUG) {
      console.debug(
        `[docker] Container check failed for ${containerId}:`,
        error instanceof Error ? error.message : error,
      );
    }
    return false;
  }
}
