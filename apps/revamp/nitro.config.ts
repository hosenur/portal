import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: ".",
  apiDir: "./src/server",
  experimental: {
    websocket: true,
  },
});
