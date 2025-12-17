import type { Route } from "./+types/home";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Link } from "react-router";
import { baseOptions } from "@/lib/layout.shared";
import { AnimatedHero } from "@/components/animated-hero";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="p-8 pt-40 flex flex-col items-start text-left flex-1 w-full max-w-[1400px] mx-auto">
        <AnimatedHero />
        <p className="text-fd-muted-foreground mb-6 max-w-2xl text-lg">
          Portal is a comprehensive mobile-first web UI for OpenCode, solving
          the web UI limitations with a complete solution that eliminates
          configuration complexity so you can focus on development.
        </p>
        <Link
          className="text-sm bg-fd-primary text-fd-primary-foreground rounded-full font-medium px-6 py-3 hover:bg-fd-primary/90 transition-colors"
          to="/docs"
        >
          Open Docs
        </Link>
        <div className="mt-12 mb-8">
          <img
            src="/screenshot.png"
            alt="Portal Screenshot"
            className="max-w-full h-auto shadow-lg border"
          />
        </div>
      </div>
    </HomeLayout>
  );
}
