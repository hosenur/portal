import { defineHandler } from "nitro/h3";

export default defineHandler(() => {
  return [
    {
      name: "codex",
      description: "Codex coding agent",
    },
  ];
});
