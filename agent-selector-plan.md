# Agent selector plan

- Add an `/api/opencode/[port]/agents` endpoint that calls `client.app.agents()` and returns the list.
- Add a `useAgents` hook in `apps/web/src/hooks/use-opencode.ts`.
- Create a per-session agent store keyed by `sessionId` (in-memory, not persisted).
- Build an `AgentSelect` component near the message composer that lists all agents.
- Default selection to `plan` when present; otherwise first agent.
- Include the selected agent in the session prompt payload and server handler.
