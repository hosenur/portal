import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("releases", "routes/releases.tsx"),
  route("docs/*", "docs/page.tsx"),
  route("api/search", "docs/search.ts"),
  route("api/og", "api/og.tsx"),
] satisfies RouteConfig;
