import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <div className="card">
      <h2>About</h2>
      <p>
        This route is file-based. Add new files in <code>src/routes</code> to
        expand the router.
      </p>
    </div>
  );
}
