#!/bin/bash

# Portal Installation Script
# Installs the 'portal' command globally

set -e

INSTALL_DIR="$HOME/.local/bin"
COMMAND_NAME="portal"

echo "Installing Portal..."

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Remove existing portal script if present
if [ -f "$INSTALL_DIR/$COMMAND_NAME" ]; then
  echo "Removing existing Portal installation..."
  rm -f "$INSTALL_DIR/$COMMAND_NAME"
fi

# Create the portal command script
cat > "$INSTALL_DIR/$COMMAND_NAME" << 'EOF'
#!/bin/bash
set -e

# Debug: PORTAL_DEBUG=1 ./portal
if [ "${PORTAL_DEBUG:-0}" = "1" ]; then
  set -x
fi

log(){ echo "[portal] $*"; }

# Get current working directory to mount into container
PROJECT_DIR="$(pwd)"
log "Project directory: $PROJECT_DIR"

# --- Get Tailscale IPv4 dynamically ---
TS_IP="$(tailscale ip -4 2>/dev/null || true)"
if [ -z "$TS_IP" ]; then
  log "ERROR: Tailscale not running or no Tailscale IPv4 found."
  exit 1
fi
log "Tailscale IP: $TS_IP"

cleanup() {
  rc=$?
  echo ""
  log "Shutting down... (exit code: $rc)"
  docker stop portal-ui 2>/dev/null || true
  docker rm portal-ui 2>/dev/null || true
  docker stop portal-opencode 2>/dev/null || true
  docker rm portal-opencode 2>/dev/null || true
  log "Done."
  exit $rc
}
trap cleanup EXIT INT TERM

# --- Start OpenCode in Docker container ---
log "Starting OpenCode container on http://$TS_IP:4000 ..."
docker rm -f portal-opencode 2>/dev/null || true
docker run -d \
  --name portal-opencode \
  --network host \
  -v "$PROJECT_DIR:/app" \
  -w /app \
  ghcr.io/sst/opencode:1.0.162 \
  serve --hostname "$TS_IP" --port 4000

log "OpenCode container started"

# Wait for OpenCode
log "Waiting for OpenCode to be reachable..."
for i in $(seq 1 40); do
  if curl -fsS "http://$TS_IP:4000" >/dev/null 2>&1; then
    log "OpenCode is reachable."
    break
  fi
  if [ "$i" -eq 40 ]; then
    log "ERROR: OpenCode not reachable at http://$TS_IP:4000"
    log "OpenCode container logs:"
    docker logs portal-opencode
    exit 1
  fi
  sleep 0.25
done

# --- Start Portal UI (exposed only on Tailscale) ---
log "Starting Portal UI on http://$TS_IP:3000 ..."
docker rm -f portal-ui 2>/dev/null || true
docker run -d \
  --name portal-ui \
  --network host \
  -e HOST="$TS_IP" \
  -e PORT=3000 \
  -e OPENCODE_SERVER_URL="http://$TS_IP:4000" \
  ghcr.io/hosenur/portal:latest

log "✓ Portal UI: http://$TS_IP:3000"
log "✓ OpenCode : http://$TS_IP:4000"
log "✓ Project  : $PROJECT_DIR"
log "Press Ctrl+C to stop."

docker logs -f portal-opencode &
docker logs -f portal-ui &
wait
EOF

# Make the command executable
chmod +x "$INSTALL_DIR/$COMMAND_NAME"

# Check if the install directory is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo ""
  echo "Adding $INSTALL_DIR to PATH..."

  # Determine shell config file
  if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
  elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
  else
    SHELL_CONFIG="$HOME/.profile"
  fi

  # Add to PATH if not already there
  if ! grep -q "$INSTALL_DIR" "$SHELL_CONFIG" 2>/dev/null; then
    echo "" >> "$SHELL_CONFIG"
    echo "# Added by Portal installer" >> "$SHELL_CONFIG"
    echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_CONFIG"
    echo "Added to $SHELL_CONFIG"
  fi

  echo ""
  echo "Please run: source $SHELL_CONFIG"
  echo "Or restart your terminal to use the 'portal' command"
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "Usage: Run 'portal' in any directory to start OpenCode server and Portal UI"
