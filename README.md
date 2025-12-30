# OpenCode Portal

![banner](/banner.png)

> **Disclaimer**: This is a **personal project** and is **not related** to [https://github.com/sst/opencode](https://github.com/sst/opencode) or the SST team. This portal is a personal-built interface for interacting with OpenCode instances.

A web-based UI for [OpenCode](https://opencode.ai), the AI coding agent. This portal provides a browser interface to interact with OpenCode sessions, view messages, and chat with the AI assistant.

## Quick Start

### Using npx (Recommended)

The easiest way to run OpenCode Portal is using npx:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run OpenCode Portal
npx openportal
```

This will:

- Start the OpenCode server on port 4000
- Start the web UI on port 3000
- Open your browser automatically

### Installation

You can also install globally:

```bash
npm install -g openportal

# Then run in any project directory
openportal
```

### CLI Options

```bash
openportal [options]

Options:
  -V, --version           output the version number
  -p, --port <port>       Port for web UI (default: "3000")
  --opencode-port <port>  Port for OpenCode server (default: "4000")
  -d, --directory <path>  Working directory for OpenCode
  --no-browser            Do not open browser automatically
  --skip-opencode-check   Skip OpenCode installation check
  -h, --help              display help for command
```

### Prerequisites

OpenCode must be installed on your system. Install it using one of these methods:

```bash
# Using curl (macOS/Linux)
curl -fsSL https://opencode.ai/install | bash

# Using npm
npm install -g opencode

# Using Homebrew (macOS)
brew install sst/tap/opencode
```

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
4. Run the development server:
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
- Follow the existing component patterns in `apps/web/src/components/`
- Use Tailwind CSS for styling
- Maintain consistent naming conventions
- Add proper TypeScript types

### Getting Help

- Check existing [issues](https://github.com/hosenur/portal/issues) before creating new ones
- Join the discussion in existing issues
- Be respectful and constructive in all interactions

## License

MIT
