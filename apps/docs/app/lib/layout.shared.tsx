import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/hosenur/portal",
    nav: {
      title: (
        <div className="flex items-center gap-4">
          <span>Portal</span>
        </div>
      ),
    },
    links: [
      {
        text: "Docs",
        url: "/docs",
      },
      {
        text: "Discord",
        url: "https://discord.gg/7UJ5KYfhNE",
      },
    ],
  };
}
