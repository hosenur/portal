# OpenCode Portal

![banner](https://raw.githubusercontent.com/hosenur/portal/main/banner.png)

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

## CLI Options

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

### Examples

```bash
# Use custom ports
openportal --port 8080 --opencode-port 5000

# Don't open browser
openportal --no-browser

# Specify a different project directory
openportal -d /path/to/other/project
```

## Prerequisites

OpenCode must be installed on your system. Install it using one of these methods:

```bash
# Using curl (macOS/Linux)
curl -fsSL https://opencode.ai/install | bash

# Using npm
npm install -g opencode

# Using Homebrew (macOS)
brew install sst/tap/opencode
```

## Features

OpenCode Portal provides:

- Session management (create, view, delete sessions)
- Real-time chat interface with the AI assistant
- File mention support (`@filename` to reference files)
- Model selection
- Dark/light theme support
- Mobile-first responsive design

## Why This Project?

OpenCode comes with its own official web UI, but it has some limitations:

- Not mobile responsive
- Limited mobile experience

This project provides a mobile-first, responsive interface for interacting with OpenCode instances remotely.

## Use Case

This portal is designed for remote access to your OpenCode instance. Deploy it on a VPS alongside OpenCode, then use [Tailscale](https://tailscale.com) (or similar VPN) to securely connect from your mobile device or any other machine.

```
[Your Phone] ---(Tailscale)---> [VPS running Portal + OpenCode]
```

## License

MIT
