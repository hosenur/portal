import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { RouterProvider } from "react-aria-components";
import { ThemeProvider } from "@/providers/theme-provider";
import Cmd from "@/components/cmd";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();

  return (
    <ThemeProvider>
      <RouterProvider navigate={(path) => navigate({ to: path })}>
        <div className="page">
          <section className="content">
            <Outlet />
          </section>
          <Cmd />
        </div>
      </RouterProvider>
    </ThemeProvider>
  );
}
