import type { Route } from "./+types/page";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { source } from "@/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import browserCollections from "fumadocs-mdx:collections/browser";
import { baseOptions } from "@/lib/layout.shared";
import { useFumadocsLoader } from "fumadocs-core/source/client";

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params["*"].split("/").filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Response("Not found", { status: 404 });

  return {
    path: page.path,
    pageTree: await source.serializePageTree(source.getPageTree()),
    title: page.data.title,
    description: page.data.description,
  };
}

export function meta({ data }: Route.MetaArgs) {
  const title = data?.title || "Documentation";
  const description = data?.description || "OpenCode Portal Documentation";
  const ogImageUrl = `/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;

  return [
    { title: `${title} - OpenCode Portal` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} - OpenCode Portal` },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:image", content: ogImageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: `${title} - OpenCode Portal` },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImageUrl },
  ];
}

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, default: Mdx, frontmatter }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle className="-">{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <Mdx components={{ ...defaultMdxComponents }} />
        </DocsBody>
      </DocsPage>
    );
  },
});

export default function Page({ loaderData }: Route.ComponentProps) {
  const Content = clientLoader.getComponent(loaderData.path);
  const { pageTree } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Content />
    </DocsLayout>
  );
}
