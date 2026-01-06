import Docker from "dockerode";

export interface DockerConnectionOptions {
  socketPath?: string;
  host?: string;
  port?: number;
}

export interface DockerOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
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

export async function stopAndRemoveContainer(
  containerId: string,
  options: { timeout?: number; force?: boolean } = {},
): Promise<DockerOperationResult> {
  const { timeout = 10, force = true } = options;

  try {
    const docker = getDockerClient();
    const container = docker.getContainer(containerId);

    let containerInfo;
    try {
      containerInfo = await container.inspect();
    } catch {
      return { success: true };
    }

    if (containerInfo.State.Running) {
      try {
        await container.stop({ t: timeout });
      } catch (stopError) {
        const isAlreadyStopped =
          stopError instanceof Error &&
          stopError.message.includes("is not running");
        if (!isAlreadyStopped) {
          console.warn(
            `[docker] Stop warning for ${containerId.substring(0, 12)}:`,
            stopError instanceof Error ? stopError.message : stopError,
          );
        }
      }
    }

    await container.remove({ force });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `[docker] Failed to remove container ${containerId.substring(0, 12)}:`,
      err.message,
    );
    return { success: false, error: err };
  }
}

export async function ensureImageExists(
  imageName: string,
  onProgress?: (status: string) => void,
): Promise<DockerOperationResult> {
  const docker = getDockerClient();

  try {
    await docker.getImage(imageName).inspect();
    onProgress?.(`Image ${imageName} already available locally`);
    return { success: true };
  } catch {
    onProgress?.(`Pulling image ${imageName}...`);

    return new Promise((resolve) => {
      docker.pull(
        imageName,
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            console.error(
              `[docker] Pull failed for ${imageName}:`,
              err.message,
            );
            resolve({ success: false, error: err });
            return;
          }

          docker.modem.followProgress(stream, (progressErr: Error | null) => {
            if (progressErr) {
              console.error(
                `[docker] Pull error for ${imageName}:`,
                progressErr.message,
              );
              resolve({ success: false, error: progressErr });
              return;
            }

            onProgress?.(`Image ${imageName} pulled successfully`);
            resolve({ success: true });
          });
        },
      );
    });
  }
}

const SENSITIVE_PATHS_UNIX = [
  "/",
  "/etc",
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
  "/boot",
  "/dev",
  "/proc",
  "/sys",
  "/run",
  "/var/run",
  "/root",
];

const SENSITIVE_PATHS_WINDOWS = [
  "c:/",
  "c:/windows",
  "c:/program files",
  "c:/program files (x86)",
  "c:/programdata",
];

export function validateMountPath(directoryPath: string): {
  valid: boolean;
  reason?: string;
} {
  const normalizedPath = directoryPath.replace(/\\/g, "/").toLowerCase();
  const sensitivePaths =
    process.platform === "win32"
      ? SENSITIVE_PATHS_WINDOWS
      : SENSITIVE_PATHS_UNIX;

  for (const sensitivePath of sensitivePaths) {
    if (normalizedPath === sensitivePath) {
      return {
        valid: false,
        reason: `Cannot mount sensitive system directory: ${directoryPath}`,
      };
    }
  }

  const isAbsolute =
    process.platform === "win32"
      ? /^[a-zA-Z]:[\\/]/.test(directoryPath)
      : directoryPath.startsWith("/");

  if (!isAbsolute) {
    return { valid: false, reason: `Path must be absolute: ${directoryPath}` };
  }

  return { valid: true };
}
