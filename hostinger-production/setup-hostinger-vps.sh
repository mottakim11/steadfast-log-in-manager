#!/bin/bash
# ====================================================================
# 🚀 1-Click Automated Setup for Hostinger VPS (Ubuntu / Debian)
# Steadfast Secure Login Manager - Central Admin Server
# ====================================================================

set -e

echo "--------------------------------------------------------"
echo "  Starting Automated Production Setup on Hostinger VPS..."
echo "--------------------------------------------------------"

# 1. Update OS packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw nginx

# 2. Install Node.js v22 LTS & npm
echo "⚙️ Installing Node.js v22 (LTS)..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install PM2 process manager
echo "⚡ Installing PM2 globally..."
sudo npm install -g pm2

# 4. Install production dependencies
echo "📥 Installing server dependencies..."
npm install --production

# 5. Create logs directory
mkdir -p logs

# 6. Start Server with PM2
echo "🚀 Starting Steadfast Login Server via PM2..."
pm2 start ecosystem.config.js
pm2 save

# 7. Configure PM2 to start automatically on VPS reboot
echo "🔄 Configuring PM2 auto-startup..."
STARTUP_CMD=$(pm2 startup systemd | grep "sudo env" || true)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
fi

# 8. Configure Firewall (UFW)
echo "🛡️ Configuring UFW Firewall..."
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 3000/tcp || true
echo "y" | sudo ufw enable || true

SERVER_IP=$(curl -s https://ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "=========================================================="
echo "🎉 SUCCESS! Steadfast Server is LIVE and RUNNING!"
echo "=========================================================="
echo "👉 Admin Panel Direct URL: http://${SERVER_IP}:3000"
echo "👉 Default Admin Username: admin"
echo "👉 Default Admin Password: admin123456"
echo ""
echo "📋 Useful PM2 Commands:"
echo "   pm2 status               (Check server status)"
echo "   pm2 logs steadfast-server (View real-time logs)"
echo "   pm2 restart steadfast-server (Restart server)"
echo "=========================================================="
