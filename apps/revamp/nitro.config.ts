import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: ".",
  preset: "bun",
  apiDir: "./src/server",
});
