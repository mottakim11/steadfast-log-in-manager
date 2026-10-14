# 🚀 Hostinger হোস্টিং ডিপ্লয়মেন্ট গাইড (Hostinger Production Deployment Guide)

এই ফোল্ডারে থাকা ফাইলগুলো **Hostinger VPS** এবং **Hostinger Web / Cloud Hosting**-এর জন্য সম্পূর্ণ রেডি করা। এটি হোস্ট করার পর **পাসওয়ার্ড বা অ্যাকাউন্ট কখনো রিসেট হবে না**, সব ডাটা Hostinger-এর হার্ডডিস্কে আজীবনের জন্য পার্মানেন্ট থাকবে।

---

## 📌 আপনি Hostinger-এর কোন প্ল্যান ব্যবহার করছেন?

- **যদি Hostinger KVM VPS (Ubuntu) ব্যবহার করেন** ➡️ [সেকশন ১ দেখুন (সবচেয়ে সহজ ও সেরা)](#-সেকশন-১-hostinger-vps-এ-ডিপ্লয়-করার-নিয়ম)
- **যদি Hostinger Shared / Cloud Web Hosting (hPanel) ব্যবহার করেন** ➡️ [সেকশন ২ দেখুন](#-সেকশন-২-hostinger-shared--cloud-hosting-hpanel-এ-ডিপ্লয়-করার-নিয়ম)

---

## 🖥️ সেকশন ১: Hostinger VPS-এ ডিপ্লয় করার নিয়ম (প্রস্তাবিত)

Hostinger VPS-এ Ubuntu 22.04 বা 24.04 নির্বাচন করুন।

### ধাপ ১: ফাইল VPS-এ আপলোড করুন
আপনার কম্পিউটার থেকে `hostinger-production` ফোল্ডারটি VPS-এ আপলোড করুন (FileZilla / WinSCP অথবা Git দিয়ে)।
অথবা টার্মিনাল দিয়ে:
```bash
scp -r hostinger-production root@YOUR_VPS_IP:/var/www/steadfast-server
```

### ধাপ ২: VPS-এ SSH দিয়ে ঢুকুন
```bash
ssh root@YOUR_VPS_IP
cd /var/www/steadfast-server
```

### ধাপ ৩: ১-ক্লিকে অটোমেটিক সেটআপ স্ক্রিপ্ট রান করুন
আমরা একটি অটোমেটিক ইনস্টলার বানিয়ে দিয়েছি, যা Node 22, PM2, ফায়ারওয়াল সব ১ ক্লিকে কনফিগার করে সার্ভার লাইভ করে দেবে:
```bash
chmod +x setup-hostinger-vps.sh
./setup-hostinger-vps.sh
```
স্ক্রিপ্টটি শেষ হলে স্ক্রিনে আপনার অ্যাডমিন প্যানেলের লাইভ লিঙ্ক দেখতে পাবেন:
`http://YOUR_VPS_IP:3000`

---

### ধাপ ৪: ফ্রি SSL ও ডোমেন কানেক্ট করার নিয়ম

আপনার যদি একটি ডোমেন থাকে (যেমন `auth.yourdomain.com`), তবে ২ ভাবে এটি সেটআপ করতে পারেন:

#### উপায় A: Nginx ও ফ্রি Let's Encrypt SSL (জনপ্রিয়)
```bash
# Nginx কনফিগারেশন কপি করুন
sudo cp nginx-hostinger.conf /etc/nginx/sites-available/steadfast.conf

# আপনার ডোমেন নাম বসান
sudo nano /etc/nginx/sites-available/steadfast.conf
# (server_name your-domain.com পরিবর্তন করে আপনার ডোমেন দিন, তারপর Ctrl+O এবং Ctrl+X)

# সাইট এনাবেল করুন
sudo ln -s /etc/nginx/sites-available/steadfast.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# ফ্রি SSL সার্টিফিকেট ইনস্টল করুন
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### উপায় B: Cloudflare Tunnel দিয়ে (সবচেয়ে সহজ, SSL কেনার দরকার নেই)
1. Cloudflare Dashboard > **Zero Trust** > **Networks** > **Tunnels**-এ যান।
2. **Create a Tunnel** ক্লিক করুন (নাম দিন: `steadfast-server`)।
3. Cloudflare স্ক্রিনে একটি ১-লাইনের কমান্ড দেবে, সেটি VPS টার্মিনালে পেস্ট করুন।
4. Public Hostname-এ গিয়ে Service Type: `HTTP` এবং URL: `localhost:3000` সিলেক্ট করুন।
5. সাথে সাথেই আপনার ডোমেনে হাই-স্পিড গ্লোবাল HTTPS লাইভ হয়ে যাবে!

---

## 🌐 সেকশন ২: Hostinger Shared / Cloud Hosting (hPanel) এ ডিপ্লয় করার নিয়ম

যদি আপনার Hostinger-এর Web / Cloud Hosting প্যাকেজ থাকে এবং hPanel থাকে:

### ধাপ ১: Node.js অ্যাপ্লিকেশন তৈরি করুন
1. Hostinger **hPanel**-এ লগইন করুন।
2. বাঁপাশের মেনু থেকে **Advanced** > **Node.js**-এ ক্লিক করুন।
3. **Create Application** বাটনে ক্লিক করুন:
   - **Node.js version:** `20.x` বা `22.x` সিলেক্ট করুন।
   - **Application root:** যে ফোল্ডারে রাখতে চান (যেমন: `public_html` অথবা `steadfast`)।
   - **Application startup file:** `server.js` লিখুন।
   - **Application mode:** `Production` সিলেক্ট করুন।
4. **Create** ক্লিক করুন।

### ধাপ ২: ফাইল আপলোড করুন
1. hPanel-এর **File Manager** খুলুন।
2. আপনার তৈরি করা অ্যাপ্লিকেশন ফোল্ডারে যান।
3. আপনার কম্পিউটারের `dist/hostinger-production.zip` ফাইলটি আপলোড করুন এবং **Extract** করুন।
4. নিশ্চিত করুন `server.js`, `database.js`, `public`, `data`, `package.json` সব ফাইল ঠিকঠাক আছে।

### ধাপ ৩: ডিপেন্ডেন্সি ইন্সটল ও সার্ভার স্টার্ট
1. আবার hPanel **Node.js** সেকশনে যান।
2. **NPM Install** বাটনে ক্লিক করুন।
3. **Start Application** (বা Restart) বাটনে ক্লিক করুন।
4. আপনার ডোমেনে ঢুকলেই অ্যাডমিন প্যানেল দেখতে পাবেন!

---

## 🧩 ক্রোম এক্সটেনশনে নতুন সার্ভার লিঙ্ক দেওয়া

সার্ভার Hostinger-এ চালু হওয়ার পর:
1. কর্মচারীদের বা আপনার ব্রাউজারের ক্রোম এক্সটেনশনের আইকনে ক্লিক করে **Settings (গিয়ার আইকন)**-এ যান।
2. **Server URL** বক্সে আপনার নতুন Hostinger URL দিন:
   - উদাহরণ: `https://auth.yourdomain.com` অথবা `http://YOUR_VPS_IP:3000`
3. **Access Token** বক্সে অ্যাডমিন প্যানেলের Token দিন।
4. **Test Connection & Save** বাটনে ক্লিক করুন। 
5. সবুজ রঙের **Connected!** মেসেজ আসবে। এখন Steadfast লগইন পেজে গিয়ে ১ ক্লিকে অটো-লগইন উপভোগ করুন!

---

## ⚙️ প্রয়োজনীয় PM2 কমান্ড (VPS-এর জন্য):
- `pm2 status` ➡️ সার্ভার চলছে কি না তা দেখা
- `pm2 logs steadfast-server` ➡️ লাইভ লগ চেক করা
- `pm2 restart steadfast-server` ➡️ সার্ভার রিস্টার্ট দেওয়া
- `pm2 stop steadfast-server` ➡️ সার্ভার বন্ধ করা
