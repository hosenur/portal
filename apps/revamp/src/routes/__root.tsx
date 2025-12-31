import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import nitroLogo from "../assets/nitro.svg";
import viteLogo from "../assets/vite.svg";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="page">
      <header className="hero">
        <div className="logo-row">
          <a href="https://v3.nitro.build/" target="_blank" rel="noreferrer">
            <img src={nitroLogo} className="logo" alt="Nitro logo" />
          </a>
          <a href="https://vite.dev" target="_blank" rel="noreferrer">
            <img src={viteLogo} className="logo" alt="Vite logo" />
          </a>
        </div>
        <h1>Nitro + Vite</h1>
        <nav className="nav">
          <Link to="/" activeProps={{ className: "active" }}>
            Home
          </Link>
          <Link to="/about" activeProps={{ className: "active" }}>
            About
          </Link>
        </nav>
      </header>
      <section className="content">
        <Outlet />
      </section>
      <TanStackRouterDevtools />
    </div>
  );
}
