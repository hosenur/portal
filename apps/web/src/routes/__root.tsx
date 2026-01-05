import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { RouterProvider } from "react-aria-components";
import { ThemeProvider } from "@/providers/theme-provider";
import { PostHogProvider } from "@/providers/posthog-provider";
import { Toast } from "@/components/ui/toast";
import Cmd from "@/components/cmd";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();

  return (
    <PostHogProvider>
      <ThemeProvider>
        <RouterProvider navigate={(path) => navigate({ to: path })}>
          <div className="page">
            <section className="content">
              <Outlet />
            </section>
            <Cmd />
            <Toast position="top-right" />
          </div>
        </RouterProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
}
