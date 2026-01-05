# OpenCode Portal

[![npm version](https://img.shields.io/npm/v/openportal.svg)](https://www.npmjs.com/package/openportal)
[![Discord](https://img.shields.io/discord/1234567890?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/7UJ5KYfhNE)

> **Disclaimer**: This is a **personal project** and is **not related** to [https://github.com/sst/opencode](https://github.com/sst/opencode) or the SST team. This portal is a personal-built interface for interacting with OpenCode instances.

A web-based UI for [OpenCode](https://opencode.ai), the AI coding agent. This portal provides a browser interface to interact with OpenCode sessions, view messages, and chat with the AI assistant.

## Quick Start

### Using bunx (Recommended)

The easiest way to run OpenCode Portal is using bunx:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run OpenCode Portal
bunx openportal
```

> **Note**: OpenPortal works best when paired with Bun. Node.js may have some rough edges.

This will:

- Start the OpenCode server (default port: 4000)
- Start the web UI (default port: 3000)
- Automatically find available ports if defaults are busy

### Installation

You can also install globally:

```bash
bun install -g openportal

# Then run in any project directory
openportal
```

### CLI Commands

```bash
openportal                    # Start OpenCode + Web UI
openportal run                # Start only OpenCode server (no Web UI)
openportal stop               # Stop running instances
openportal list               # List running instances
openportal clean              # Clean up stale entries
```

### CLI Options

```bash
openportal [command] [options]

Options:
  -h, --help              Show help message
  -d, --directory <path>  Working directory (default: current directory)
  -p, --port <port>       Web UI port (default: 3000, auto-finds if busy)
  --opencode-port <port>  OpenCode server port (default: 4000, auto-finds if busy)
  --hostname <host>       Hostname to bind (default: 0.0.0.0)
  --name <name>           Instance name (default: directory name)
```

### Prerequisites

OpenCode must be installed on your system. Install it using one of these methods:

```bash
# Using curl (macOS/Linux)
curl -fsSL https://opencode.ai/install | bash

# Using bun
bun install -g opencode

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

## Documentation

For full documentation, visit [openportal.space/docs](https://openportal.space/docs)

## Getting Help

- Join our [Discord community](https://discord.gg/7UJ5KYfhNE)
- Check existing [issues](https://github.com/hosenur/portal/issues) before creating new ones
- Report bugs or request features on [GitHub](https://github.com/hosenur/portal)

## License

MIT
