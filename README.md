# OpenCode Portal

A web-based UI for [OpenCode](https://opencode.ai), the AI coding agent. This portal provides a browser interface to interact with OpenCode sessions, view messages, and chat with the AI assistant.

## Overview

OpenCode Portal connects to a running OpenCode server and provides:

- Session management (create, view, delete sessions)
- Real-time chat interface with the AI assistant
- File mention support (`@filename` to reference files)
- Model selection
- Dark/light theme support

## Use Case

This portal is designed for remote access to your OpenCode instance. Deploy the portal on a VPS alongside OpenCode, then use [Tailscale](https://tailscale.com) (or similar VPN) to securely connect from your mobile device or any other machine.

**Example setup:**
```
[Your Phone] ---(Tailscale)---> [VPS running Portal + OpenCode]
```

## Prerequisites

- A running OpenCode server (default port: 4000)
- [Bun](https://bun.sh) runtime (recommended) or Node.js

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENCODE_SERVER_URL` | URL of the OpenCode server (e.g., `http://localhost:4000`) | Yes |

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Set environment variable
export OPENCODE_SERVER_URL=http://localhost:4000

# Run development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker

```bash
# Build the image
docker build -t opencode-portal .

# Run the container
docker run -p 3000:3000 -e OPENCODE_SERVER_URL=http://localhost:4000 opencode-portal
```

## GitHub Container Registry

Pre-built images are available at:

```bash
docker pull ghcr.io/hosenur/portal:latest
docker run -p 3000:3000 -e OPENCODE_SERVER_URL=http://localhost:4000 ghcr.io/hosenur/portal:latest
```

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [React Aria Components](https://react-spectrum.adobe.com/react-aria/) - Accessible UI components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Elysia](https://elysiajs.com) - API routing
- [OpenCode SDK](https://www.npmjs.com/package/@opencode-ai/sdk) - OpenCode API client

## License

MIT
