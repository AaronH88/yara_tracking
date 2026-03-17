#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/babytracker"
DATA_DIR="/var/lib/babytracker"
SERVICE_USER="babytracker"
SERVICE_FILE="babytracker.service"

echo "=== Baby Tracker — Fresh LXC Setup ==="

# Install system dependencies
echo "Installing system dependencies..."
apt update && apt install -y python3 python3-venv nodejs npm sqlite3

# Create service user (no login shell)
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "Creating service user: $SERVICE_USER"
    useradd -r -s /bin/false "$SERVICE_USER"
fi

# Create directories
echo "Creating directories..."
mkdir -p "$APP_DIR" "$DATA_DIR"
chown "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

# Copy application code to /opt/babytracker
echo "Copying application code..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cp -r "$REPO_DIR/babytracker/backend" "$APP_DIR/backend"
cp -r "$REPO_DIR/babytracker/frontend" "$APP_DIR/frontend"

# Install Python dependencies
echo "Setting up Python virtual environment..."
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# Build frontend
echo "Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npm run build
cd -

# ── Tailscale + TLS cert ──────────────────────────────────────────────────────
echo "Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

echo ""
echo "=== Tailscale Authentication Required ==="
tailscale up
echo ""
echo "Open the URL above in your browser, authenticate, then press Enter to continue..."
read -r

if ! tailscale status &>/dev/null; then
    echo "ERROR: Tailscale not connected. Re-run after authenticating."
    exit 1
fi

TAILSCALE_FQDN=$(tailscale status --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['Self']['DNSName'].rstrip('.'))")
echo "Tailscale FQDN: $TAILSCALE_FQDN"

echo "Provisioning TLS certificate..."
tailscale cert "$TAILSCALE_FQDN"
mkdir -p /etc/babytracker/certs
mv "${TAILSCALE_FQDN}".* /etc/babytracker/certs/
chown "$SERVICE_USER":"$SERVICE_USER" /etc/babytracker/certs/*
chmod 640 /etc/babytracker/certs/*

# Inject the real FQDN into the service file
sed -i "s|TAILSCALE_FQDN_PLACEHOLDER|${TAILSCALE_FQDN}|g" "$SCRIPT_DIR/$SERVICE_FILE"
# ─────────────────────────────────────────────────────────────────────────────

# Install systemd service
echo "Installing systemd service..."
cp "$SCRIPT_DIR/$SERVICE_FILE" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "$SERVICE_FILE"
systemctl start "$SERVICE_FILE"

echo "=== Setup complete ==="
echo "Baby Tracker is running. Database: $DATA_DIR/db.sqlite"
