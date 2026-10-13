# Steadfast Secure Login Manager - Server Deployment Guide

## 📌 Architecture Overview

1. **Central Admin Panel & Backend API** (`server/`):
   - Host on any Linux VPS (Ubuntu/Debian) or Docker or Cloudflare Tunnel.
   - Manages Offices, Accounts (with AES-256-GCM encrypted passwords), Extension Access Tokens, and Live Activity Audit Logs.
   - Dedicated Admin Login page with rate limiting and JWT session control.
   - Direct link integration to Chrome Web Store.

2. **Employee Browser Extension (Manifest V3)** (`extension/`):
   - Published to Google Chrome Web Store or loaded via `.zip`.
   - Installed on employee browsers.
   - Connects to your Admin Server using a secret Access Token.
   - Automatically injects on `https://steadfast.com.bd/moderator/login`.
   - On button click: Fetches the latest credentials from the server in real-time, auto-fills email & password, and submits the login form.
   - **Real-Time Password Sync**: If Admin updates any password in the panel, the very next click by an employee instantly logs in with the new password!

---

## 🚀 1. Quick Local Testing (Windows)

Run the server locally:

```powershell
cd server
npm start
```

- Open browser at: `http://localhost:3000`
- Default Admin Login:
  - **Username**: `admin`
  - **Password**: `admin123456`
  *(You can change the password anytime from the top right lock icon)*

---

## 🌐 2. Deploy to Linux VPS (Ubuntu / Debian)

### Method A: Using PM2 (Recommended & Simple)

1. Connect to your VPS via SSH:
   ```bash
   ssh root@your-vps-ip
   ```

2. Install Node.js (v20 or v22):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

3. Upload the `server` folder to your VPS (e.g., `/var/www/steadfast-server`) and run:
   ```bash
   cd /var/www/steadfast-server
   npm install --production
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. Your server will run continuously on port `3000`.

---

### Method B: Using Docker & Docker Compose

1. In the `server` folder:
   ```bash
   docker compose up -d
   ```
2. Check running status:
   ```bash
   docker compose ps
   ```

---

## 🔒 3. Setup Free SSL & Custom Domain with Cloudflare Tunnel

Cloudflare Tunnel allows you to point a custom domain (e.g., `https://steadfast-auth.yourdomain.com`) directly to `http://localhost:3000` on your VPS without opening firewall ports or buying SSL certificates:

1. In Cloudflare Dashboard, go to **Zero Trust** > **Networks** > **Tunnels**.
2. Click **Create a Tunnel** and name it (e.g., `steadfast-server`).
3. Follow the one-line command to install `cloudflared` on your VPS.
4. Add a Public Hostname:
   - **Subdomain**: `steadfast-auth` (or any name)
   - **Domain**: `yourdomain.com`
   - **Service Type**: `HTTP`
   - **URL**: `localhost:3000`
5. Save. Your Admin Panel and Extension API are now live with high-speed HTTPS globally!

---

## 🧩 4. Publishing Extension to Google Chrome Web Store

1. Open Google Chrome Developer Dashboard: `https://chrome.google.com/webstore/devcenter`
2. Pay the one-time $5 Google developer registration fee (if new account).
3. Click **New Item** and upload `dist/steadfast-extension-v3.zip`.
4. Provide the title: `Steadfast Auto Login Manager` and description.
5. In the permissions explanation, declare:
   - `storage`: "Used to store the Admin Server URL and authorization token locally."
   - `host_permissions`: "Required to communicate with the self-hosted admin server and auto-fill login credentials on steadfast.com.bd."
6. Once published, copy your Web Store URL (e.g., `https://chromewebstore.google.com/detail/...`) and paste it into **Settings** in the Admin Panel.

---

## 💻 5. Employee Browser Setup

1. Employee installs extension from Chrome Web Store (or clicks the link on the Admin Login page).
2. Click extension icon > Gear icon (Settings):
   - **Server URL**: `https://your-domain.com`
   - **Access Token**: `sflm_xxxxxxxx` (Generated from Admin Panel -> Extension Tokens)
   - Click **Test Connection & Save** (turns Green).
3. Employee opens `https://steadfast.com.bd/moderator/login`:
   - The floating Steadfast Login widget will appear with their office buttons.
   - Clicking any account instantly auto-fills and logs them in!
