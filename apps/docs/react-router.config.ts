import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/dev";
import { glob } from "node:fs/promises";
import { createGetUrl, getSlugs } from "fumadocs-core/source";

const getUrl = createGetUrl("/docs");

export default {
  ssr: true,
  presets: [vercelPreset()],
  async prerender({ getStaticPaths }) {
    const paths: string[] = [];
    const excluded: string[] = ["/api/search"];

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path);
    }

    for await (const entry of glob("**/*.mdx", { cwd: "content/docs" })) {
      paths.push(getUrl(getSlugs(entry)));
    }

    return paths;
  },
} satisfies Config;
