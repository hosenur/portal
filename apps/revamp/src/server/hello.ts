import { defineHandler } from "nitro/h3";

export default defineHandler(() => {
  return {
    message: "Hello from Nitro!",
    ok: true,
  };
});
