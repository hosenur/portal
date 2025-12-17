import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookIcon } from "lucide-react";

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

  };
}
