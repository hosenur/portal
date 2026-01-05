import { useEffect, useState } from "react";
import type { Route } from "./+types/releases";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";
import { baseOptions } from "@/lib/layout.shared";

interface Release {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
}

interface ReleaseItem {
  id: string;
  text: string;
}

export function meta(_args: Route.MetaArgs) {
  const ogImageUrl =
    "/api/og?template=release&version=Latest&features=New%20Features,Improvements,Bug%20Fixes";

  return [
    { title: "Releases - Portal" },
    {
      name: "description",
      content:
        "View all releases, changelogs, and updates for Portal - the mobile-first web UI for OpenCode.",
    },
    { property: "og:title", content: "Releases - Portal" },
    {
      property: "og:description",
      content: "View all releases, changelogs, and updates for Portal.",
    },
    { property: "og:type", content: "website" },
    { property: "og:image", content: ogImageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Releases - Portal" },
    {
      name: "twitter:description",
      content: "View all releases, changelogs, and updates for Portal.",
    },
    { name: "twitter:image", content: ogImageUrl },
  ];
}

function parseReleaseBody(body: string) {
  const cleanBody = body.replace(/<!--[\s\S]*?-->/g, "");
  const lines = cleanBody.split("\n");
  const sections: Record<string, ReleaseItem[]> = {};
  let currentSection = "Changes";
  let globalIndex = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      currentSection = headerMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(/^\s*\*\s+(.+?)\s+by\s+@/);
    if (itemMatch) {
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      sections[currentSection].push({
        id: `item-${globalIndex++}`,
        text: itemMatch[1].trim(),
      });
    }
  }

  return sections;
}

function ReleaseSkeleton() {
  return (
    <div className="border border-fd-border rounded-lg p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-20 bg-fd-muted rounded-full" />
        <div className="h-4 w-24 bg-fd-muted rounded" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full bg-fd-muted rounded" />
        <div className="h-4 w-3/4 bg-fd-muted rounded" />
        <div className="h-4 w-5/6 bg-fd-muted rounded" />
      </div>
    </div>
  );
}

export default function Releases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch(
          "https://api.github.com/repos/hosenur/portal/releases",
        );
        if (!response.ok) {
          throw new Error("Failed to fetch releases");
        }
        const data = await response.json();
        setReleases(data.filter((r: Release) => !r.draft));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load releases",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchReleases();
  }, []);

  return (
    <HomeLayout {...baseOptions()}>
      <div className="p-8 pt-20 flex flex-col items-start text-left flex-1 w-full max-w-3xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Releases</h1>
          <p className="text-fd-muted-foreground text-lg">
            Latest updates and improvements
          </p>
        </div>

        {loading && (
          <div className="w-full space-y-6">
            <ReleaseSkeleton />
            <ReleaseSkeleton />
            <ReleaseSkeleton />
          </div>
        )}

        {error && (
          <div className="w-full p-6 border border-red-500/20 bg-red-500/10 rounded-lg">
            <p className="text-red-500">{error}</p>
            <a
              href="https://github.com/hosenur/portal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fd-primary hover:underline mt-2 inline-block"
            >
              View releases on GitHub →
            </a>
          </div>
        )}

        {!loading && !error && releases.length === 0 && (
          <div className="w-full p-6 border border-fd-border rounded-lg text-center">
            <p className="text-fd-muted-foreground mb-4">No releases yet.</p>
            <Link to="/docs" className="text-fd-primary hover:underline">
              Check out the documentation →
            </Link>
          </div>
        )}

        {!loading && !error && releases.length > 0 && (
          <div className="w-full relative border-l border-fd-border ml-3 space-y-12">
            {releases
              .filter((release) => {
                const sections = parseReleaseBody(release.body);
                return Object.keys(sections).length > 0;
              })
              .map((release, index) => {
                const sections = parseReleaseBody(release.body);

                return (
                  <article key={release.tag_name} className="relative pl-8">
                    <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-fd-border bg-fd-background border border-fd-border ring-4 ring-fd-background" />

                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="text-lg font-semibold">
                        {release.tag_name}
                      </span>
                      {index === 0 && (
                        <span className="bg-fd-primary/10 text-fd-primary px-2 py-0.5 rounded-full text-xs font-medium border border-fd-primary/20">
                          Latest
                        </span>
                      )}
                      {release.prerelease && (
                        <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full text-xs font-medium border border-yellow-500/20">
                          Pre-release
                        </span>
                      )}
                      <time
                        dateTime={release.published_at}
                        className="text-fd-muted-foreground text-sm ml-auto"
                      >
                        {new Date(release.published_at).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </time>
                    </div>

                    <div className="space-y-6">
                      {Object.entries(sections).map(([title, items]) => {
                        if (title === "New Contributors" || items.length === 0)
                          return null;

                        const showHeader =
                          title !== "Changes" && title !== "What's Changed";

                        return (
                          <div key={title}>
                            {showHeader && (
                              <h3 className="text-sm font-medium text-fd-foreground mb-2">
                                {title}
                              </h3>
                            )}
                            <ul className="space-y-2.5">
                              {items.map((item) => (
                                <li
                                  key={item.id}
                                  className="text-fd-muted-foreground text-sm flex items-start leading-relaxed"
                                >
                                  <span className="mr-3 mt-2 w-1 h-1 rounded-full bg-fd-muted-foreground/50 shrink-0" />
                                  <span>{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-fd-border w-full flex justify-between items-center">
          <p className="text-fd-muted-foreground text-sm">
            <a
              href="https://github.com/hosenur/portal/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fd-primary transition-colors"
            >
              View all on GitHub
            </a>
          </p>
        </div>
      </div>
    </HomeLayout>
  );
}
