# OpenCode Portal

![banner](/public/banner.png)

> **Disclaimer**: This is a **personal project** and is **not related** to [https://github.com/sst/opencode](https://github.com/sst/opencode) or the SST team. This portal is a personal-built interface for interacting with OpenCode instances.

A web-based UI for [OpenCode](https://opencode.ai), the AI coding agent. This portal provides a browser interface to interact with OpenCode sessions, view messages, and chat with the AI assistant.

## Overview

OpenCode Portal connects to a running OpenCode server and provides:

- Session management (create, view, delete sessions)
- Real-time chat interface with the AI assistant
- File mention support (`@filename` to reference files)
- Model selection
- Dark/light theme support

## Why This Project?

OpenCode comes with its own official web UI that you can access by running:
```bash
opencode --port 4096
```

However, the official UI is **currently under development** and has some limitations:
- Not mobile responsive
- Limited mobile experience

This project was inspired by my personal need to access OpenCode from my mobile device when I don't have my laptop around. The goal is to provide a mobile-first, responsive interface for interacting with OpenCode instances remotely.

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
- [IntentUI](https://intentui.com/) - UI library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Elysia](https://elysiajs.com) - API routing
- [OpenCode SDK](https://www.npmjs.com/package/@opencode-ai/sdk) - OpenCode API client

## Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues

- **Bugs**: Report bugs by opening an issue with a clear description and steps to reproduce
- **Feature requests**: Open an issue with the `feature` label and describe the proposed enhancement

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/portal.git
   cd portal
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```
5. Run the development server:
   ```bash
   bun dev
   ```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the existing code style
3. Test your changes thoroughly
4. Update documentation if needed
5. Submit a pull request with a clear description

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns in `src/components/`
- Use Tailwind CSS for styling
- Maintain consistent naming conventions
- Add proper TypeScript types

### Getting Help

- Check existing [issues](https://github.com/rahaman/portal/issues) before creating new ones
- Join the discussion in existing issues
- Be respectful and constructive in all interactions

## License

MIT
