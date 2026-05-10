import { defineHandler } from "nitro/h3";

export default defineHandler(() => {
  return [
    {
      name: "claude",
      description: "Claude Code agent",
    },
  ];
});
