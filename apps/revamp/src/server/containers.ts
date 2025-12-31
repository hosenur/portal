import { defineHandler } from "nitro/h3";
import Docker from "dockerode";

const docker = new Docker();

export default defineHandler(async () => {
  const containers = await docker.listContainers({ all: true });

  const openCodeContainers = containers.filter((container) =>
    container.Image.includes("ghcr.io/sst/opencode"),
  );

  return {
    total: openCodeContainers.length,
    containers: openCodeContainers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, ""),
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports,
      created: new Date(c.Created * 1000).toISOString(),
    })),
  };
});
