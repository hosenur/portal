import { defineHandler } from "nitro/h3";
import { hostname } from "os";

export default defineHandler(() => {
  return { hostname: hostname() };
});
