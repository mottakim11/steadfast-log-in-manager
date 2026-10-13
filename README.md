# Steadfast Secure Login Manager (Enterprise Client-Server Edition)

Centralized Admin Server and Manifest V3 Chrome Extension for automated, real-time Steadfast Courier moderator login.

---

## 🌟 Key Architecture & Features

### 1. 🏢 Centralized Admin Web Panel (`server/`)
- **Admin Authentication**: Dedicated login screen restricted to the system administrator with brute-force rate limiting and session tokens.
- **Office-Wise Credential Vault**: Organize Steadfast Courier moderator accounts separately by branch/office (e.g. Dhanmondi, Uttara, Chittagong).
- **AES-256-GCM Encryption**: All emails and passwords are encrypted in the database using enterprise-grade AES-256-GCM.
- **Real-Time Password Sync**: Change any password in the admin panel, and employees will immediately log in with the new password on their very next click.
- **Extension Access Tokens**: Generate revocable tokens with granular office access permissions.
- **Live Audit Logs**: Monitor every automated login event with timestamps, office name, account name, token used, and IP address.
- **Chrome Web Store Integration**: One-click direct link to install the extension from the Chrome Web Store or download the `.zip`.
- **Deploy Anywhere**: Ready for Linux VPS (Ubuntu/Debian), Docker, PM2, and Cloudflare Tunnel.

### 2. 🧩 Chrome Extension (`extension/` & `dist/steadfast-extension-v3.zip`)
- **Manifest V3 Compliant**: Built strictly according to Google Chrome Web Store guidelines.
- **Zero Local Footprint**: Employees do NOT need Python or any background software installed on their PCs. Only the Chrome extension is required!
- **On-Page Floating Widget**: Injected on `https://steadfast.com.bd/moderator/login` to show office accounts.
- **One-Click Auto Login**: Securely requests the real-time credentials from the server, populates email and password without revealing the password, and triggers login automatically.

---

## 📁 Project Structure

```
SteadfastSecureLoginManager/
├── server/                         # Central Admin Server & API
│   ├── server.js                   # Express Server & API endpoints
│   ├── database.js                 # SQLite / atomic store with AES-256
│   ├── crypto.js                   # AES-256-GCM encryption/decryption
│   ├── auth.js                     # Admin JWT & Extension token middleware
│   ├── Dockerfile                  # Containerized deployment
│   ├── docker-compose.yml          # 1-click Docker orchestration
│   ├── ecosystem.config.js         # PM2 configuration for VPS
│   ├── README_DEPLOY.md            # Detailed VPS & Cloudflare setup guide
│   └── public/                     # Admin Web Dashboard & Login
│       ├── index.html              # Admin Control Panel
│       ├── login.html              # Admin Login Page
│       ├── style.css               # Modern Dark Glassmorphic Design
│       ├── app.js                  # Dashboard logic
│       ├── login.js                # Login logic
│       └── steadfast-extension.zip # Direct download package
│
├── extension/                      # Chrome Web Store Ready Extension (MV3)
│   ├── manifest.json               # Manifest V3 configuration
│   ├── icons/                      # 16x16, 48x48, 128x128 icons
│   ├── popup/                      # Extension toolbar popup
│   ├── options/                    # Settings (Server URL & Token)
│   └── content/                    # On-page Steadfast auto-fill script & styling
│
├── dist/
│   └── steadfast-extension-v3.zip  # Ready to upload to Chrome Web Store
│
└── legacy_agent/                   # Old prototype files (for archive)
```

---

## ⚡ Quick Start

### 1. Start Server
```powershell
cd server
npm start
```
Open `http://localhost:3000` (Default login: `admin` / `admin123456`).

### 2. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder (or unzip `dist/steadfast-extension-v3.zip`).
4. Click the extension icon > Settings > Enter Server URL & Token > Click **Test Connection & Save**.
5. Visit `https://steadfast.com.bd/moderator/login` and enjoy 1-click auto-login!
