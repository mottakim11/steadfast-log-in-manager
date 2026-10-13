const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const JSON_DB_PATH = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let sqliteDb = null;
let useJsonFallback = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('node:sqlite not found, falling back to atomic JSON database:', e.message);
  useJsonFallback = true;
}

// Fallback JSON in-memory cache
let jsonStore = {
  settings: {},
  offices: [],
  accounts: [],
  tokens: [],
  audit_logs: []
};

function saveJsonStore() {
  const tempPath = `${JSON_DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(jsonStore, null, 2), 'utf8');
  fs.renameSync(tempPath, JSON_DB_PATH);
}

function loadJsonStore() {
  if (fs.existsSync(JSON_DB_PATH)) {
    try {
      jsonStore = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    } catch (e) {
      console.error('Failed to load JSON database:', e);
    }
  }
}

function init() {
  if (useJsonFallback) {
    loadJsonStore();
    // Ensure all offices in json store have a secret_key
    let changed = false;
    for (const off of jsonStore.offices) {
      if (!off.secret_key) {
        off.secret_key = 'sflm_off_' + crypto.randomBytes(16).toString('hex');
        changed = true;
      }
    }
    if (changed) saveJsonStore();
    initDefaultSettings();
    return;
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      secret_key TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      office_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email_cipher TEXT NOT NULL,
      password_cipher TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      allowed_office_ids TEXT DEFAULT 'all',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      account_id TEXT,
      office_name TEXT,
      display_name TEXT,
      token_name TEXT,
      ip TEXT,
      user_agent TEXT,
      status TEXT NOT NULL
    );
  `);

  // Migration: Ensure secret_key column exists on existing offices table
  try {
    const tableInfo = sqliteDb.prepare("PRAGMA table_info(offices)").all();
    const hasSecretKey = tableInfo.some(col => col.name === 'secret_key');
    if (!hasSecretKey) {
      sqliteDb.exec("ALTER TABLE offices ADD COLUMN secret_key TEXT;");
    }
  } catch (e) {
    console.warn("Migration warning for offices table:", e.message);
  }

  // Populate secret_key for any existing office without one
  try {
    const officesWithoutKey = sqliteDb.prepare("SELECT id FROM offices WHERE secret_key IS NULL OR secret_key = ''").all();
    const updateStmt = sqliteDb.prepare("UPDATE offices SET secret_key = ? WHERE id = ?");
    for (const off of officesWithoutKey) {
      const key = 'sflm_off_' + crypto.randomBytes(16).toString('hex');
      updateStmt.run(key, off.id);
    }
  } catch (e) {
    console.warn("Error migrating office secret keys:", e.message);
  }

  initDefaultSettings();
}

function initDefaultSettings() {
  const defaultAdmin = getSetting('admin_username');
  if (!defaultAdmin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123456', salt);
    setSetting('admin_username', 'admin');
    setSetting('admin_password_hash', hash);
    setSetting('jwt_secret', crypto.randomBytes(32).toString('hex'));
    setSetting('chrome_web_store_url', 'https://chromewebstore.google.com/');
    setSetting('system_title', 'Steadfast Secure Auto Login');
  }

  // Restore from database.json if database is empty but database.json exists
  let offices = getOffices();
  if (offices.length === 0 && fs.existsSync(JSON_DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
      if (data.offices && data.offices.length > 0) {
        console.log('Restoring database from database.json backup...');
        if (!useJsonFallback && sqliteDb) {
          for (const off of (data.offices || [])) {
            sqliteDb.prepare(`INSERT OR REPLACE INTO offices (id, name, code, secret_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(off.id, off.name, off.code || '', off.secret_key || '', off.status || 'active', off.created_at || new Date().toISOString());
          }
          for (const acc of (data.accounts || [])) {
            sqliteDb.prepare(`INSERT OR REPLACE INTO accounts (id, office_id, display_name, email_cipher, password_cipher, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(acc.id, acc.office_id, acc.display_name, acc.email_cipher, acc.password_cipher, acc.status || 'active', acc.created_at || new Date().toISOString(), acc.updated_at || new Date().toISOString());
          }
          for (const tok of (data.tokens || [])) {
            sqliteDb.prepare(`INSERT OR REPLACE INTO tokens (id, token, name, allowed_office_ids, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(tok.id, tok.token, tok.name, tok.allowed_office_ids || 'all', tok.status || 'active', tok.created_at || new Date().toISOString());
          }
          for (const [k, v] of Object.entries(data.settings || {})) {
            setSetting(k, v);
          }
        }
        offices = getOffices();
      }
    } catch (e) {
      console.warn('Could not restore from database.json:', e.message);
    }
  }

  // Create default office and token only if still empty
  if (offices.length === 0) {
    const defaultOfficeId = 'office_' + Date.now();
    createOffice({
      id: defaultOfficeId,
      name: 'Main Head Office',
      code: 'MAIN',
      status: 'active'
    });

    createToken({
      name: 'Default Extension Token',
      allowed_office_ids: 'all'
    });
  }
}

// ---------------- Settings ---------------- //
function getSetting(key) {
  if (useJsonFallback) {
    return jsonStore.settings[key] || null;
  }
  const row = sqliteDb.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  if (useJsonFallback) {
    jsonStore.settings[key] = String(value);
    saveJsonStore();
    return;
  }
  sqliteDb.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function getAllSettings() {
  const keys = ['admin_username', 'chrome_web_store_url', 'system_title'];
  const res = {};
  for (const k of keys) {
    res[k] = getSetting(k);
  }
  return res;
}

// ---------------- Offices ---------------- //
function getOffices() {
  if (useJsonFallback) {
    return [...jsonStore.offices].sort((a, b) => a.name.localeCompare(b.name));
  }
  return sqliteDb.prepare('SELECT * FROM offices ORDER BY name ASC').all();
}

function getOffice(id) {
  if (useJsonFallback) {
    return jsonStore.offices.find(o => o.id === id) || null;
  }
  return sqliteDb.prepare('SELECT * FROM offices WHERE id = ?').get(id) || null;
}

function createOffice({ id, name, code, secret_key, status = 'active' }) {
  const officeId = id || 'off_' + crypto.randomBytes(6).toString('hex');
  const officeSecretKey = secret_key || ('sflm_off_' + crypto.randomBytes(16).toString('hex'));
  const createdAt = new Date().toISOString();
  if (useJsonFallback) {
    const newOffice = { id: officeId, name, code: code || '', secret_key: officeSecretKey, status, created_at: createdAt };
    jsonStore.offices.push(newOffice);
    saveJsonStore();
    return newOffice;
  }
  sqliteDb.prepare(`
    INSERT INTO offices (id, name, code, secret_key, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(officeId, name, code || '', officeSecretKey, status, createdAt);
  return getOffice(officeId);
}

function updateOffice(id, { name, code, secret_key, status }) {
  if (useJsonFallback) {
    const idx = jsonStore.offices.findIndex(o => o.id === id);
    if (idx === -1) return null;
    if (name !== undefined) jsonStore.offices[idx].name = name;
    if (code !== undefined) jsonStore.offices[idx].code = code;
    if (secret_key !== undefined) jsonStore.offices[idx].secret_key = secret_key;
    if (status !== undefined) jsonStore.offices[idx].status = status;
    saveJsonStore();
    return jsonStore.offices[idx];
  }
  const current = getOffice(id);
  if (!current) return null;
  sqliteDb.prepare(`
    UPDATE offices SET
      name = ?,
      code = ?,
      secret_key = ?,
      status = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : current.name,
    code !== undefined ? code : current.code,
    secret_key !== undefined ? secret_key : current.secret_key,
    status !== undefined ? status : current.status,
    id
  );
  return getOffice(id);
}

function regenerateOfficeSecretKey(id) {
  const newKey = 'sflm_off_' + crypto.randomBytes(16).toString('hex');
  if (useJsonFallback) {
    const idx = jsonStore.offices.findIndex(o => o.id === id);
    if (idx === -1) return null;
    jsonStore.offices[idx].secret_key = newKey;
    saveJsonStore();
    return jsonStore.offices[idx];
  }
  const current = getOffice(id);
  if (!current) return null;
  sqliteDb.prepare('UPDATE offices SET secret_key = ? WHERE id = ?').run(newKey, id);
  return getOffice(id);
}

function deleteOffice(id) {
  if (useJsonFallback) {
    jsonStore.offices = jsonStore.offices.filter(o => o.id !== id);
    jsonStore.accounts = jsonStore.accounts.filter(a => a.office_id !== id);
    saveJsonStore();
    return true;
  }
  sqliteDb.prepare('DELETE FROM accounts WHERE office_id = ?').run(id);
  sqliteDb.prepare('DELETE FROM offices WHERE id = ?').run(id);
  return true;
}

// ---------------- Accounts ---------------- //
function getAccounts(officeId = null) {
  if (useJsonFallback) {
    let list = jsonStore.accounts;
    if (officeId) {
      list = list.filter(a => a.office_id === officeId);
    }
    return list.map(a => {
      const office = jsonStore.offices.find(o => o.id === a.office_id);
      return {
        id: a.id,
        office_id: a.office_id,
        office_name: office ? office.name : 'Unknown',
        display_name: a.display_name,
        email: decrypt(a.email_cipher),
        status: a.status,
        created_at: a.created_at,
        updated_at: a.updated_at
      };
    });
  }

  let sql = `
    SELECT a.id, a.office_id, a.display_name, a.email_cipher, a.status, a.created_at, a.updated_at,
           o.name as office_name
    FROM accounts a
    LEFT JOIN offices o ON a.office_id = o.id
  `;
  const params = [];
  if (officeId) {
    sql += ' WHERE a.office_id = ?';
    params.push(officeId);
  }
  sql += ' ORDER BY o.name ASC, a.display_name ASC';

  const rows = sqliteDb.prepare(sql).all(...params);
  return rows.map(r => ({
    id: r.id,
    office_id: r.office_id,
    office_name: r.office_name || 'Unknown',
    display_name: r.display_name,
    email: decrypt(r.email_cipher),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
}

function getAccount(id) {
  if (useJsonFallback) {
    const a = jsonStore.accounts.find(x => x.id === id);
    if (!a) return null;
    const office = jsonStore.offices.find(o => o.id === a.office_id);
    return {
      id: a.id,
      office_id: a.office_id,
      office_name: office ? office.name : 'Unknown',
      display_name: a.display_name,
      email: decrypt(a.email_cipher),
      password: decrypt(a.password_cipher),
      status: a.status,
      created_at: a.created_at,
      updated_at: a.updated_at
    };
  }

  const row = sqliteDb.prepare(`
    SELECT a.*, o.name as office_name
    FROM accounts a
    LEFT JOIN offices o ON a.office_id = o.id
    WHERE a.id = ?
  `).get(id);

  if (!row) return null;
  return {
    id: row.id,
    office_id: row.office_id,
    office_name: row.office_name || 'Unknown',
    display_name: row.display_name,
    email: decrypt(row.email_cipher),
    password: decrypt(row.password_cipher),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function createAccount({ office_id, display_name, email, password, status = 'active' }) {
  const id = 'acc_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();
  const emailCipher = encrypt(email);
  const passwordCipher = encrypt(password);

  if (useJsonFallback) {
    const acc = {
      id,
      office_id,
      display_name,
      email_cipher: emailCipher,
      password_cipher: passwordCipher,
      status,
      created_at: now,
      updated_at: now
    };
    jsonStore.accounts.push(acc);
    saveJsonStore();
    return getAccount(id);
  }

  sqliteDb.prepare(`
    INSERT INTO accounts (id, office_id, display_name, email_cipher, password_cipher, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, office_id, display_name, emailCipher, passwordCipher, status, now, now);

  return getAccount(id);
}

function updateAccount(id, { office_id, display_name, email, password, status }) {
  const current = getAccount(id);
  if (!current) return null;
  const now = new Date().toISOString();

  const finalOfficeId = office_id !== undefined ? office_id : current.office_id;
  const finalDisplayName = display_name !== undefined ? display_name : current.display_name;
  const finalEmailCipher = email !== undefined ? encrypt(email) : encrypt(current.email);
  const finalPasswordCipher = password !== undefined ? encrypt(password) : encrypt(current.password);
  const finalStatus = status !== undefined ? status : current.status;

  if (useJsonFallback) {
    const idx = jsonStore.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;
    jsonStore.accounts[idx] = {
      ...jsonStore.accounts[idx],
      office_id: finalOfficeId,
      display_name: finalDisplayName,
      email_cipher: finalEmailCipher,
      password_cipher: finalPasswordCipher,
      status: finalStatus,
      updated_at: now
    };
    saveJsonStore();
    return getAccount(id);
  }

  sqliteDb.prepare(`
    UPDATE accounts SET
      office_id = ?,
      display_name = ?,
      email_cipher = ?,
      password_cipher = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `).run(finalOfficeId, finalDisplayName, finalEmailCipher, finalPasswordCipher, finalStatus, now, id);

  return getAccount(id);
}

function deleteAccount(id) {
  if (useJsonFallback) {
    jsonStore.accounts = jsonStore.accounts.filter(a => a.id !== id);
    saveJsonStore();
    return true;
  }
  sqliteDb.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return true;
}

// ---------------- Tokens (for Extension) ---------------- //
function getTokens() {
  if (useJsonFallback) {
    return [...jsonStore.tokens].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return sqliteDb.prepare('SELECT * FROM tokens ORDER BY created_at DESC').all();
}

function getTokenByValue(tokenVal) {
  if (!tokenVal) return null;
  const cleanToken = String(tokenVal).trim();

  // 1. Check custom tokens in tokens table
  let customToken = null;
  if (useJsonFallback) {
    customToken = jsonStore.tokens.find(t => t.token === cleanToken && t.status === 'active') || null;
  } else {
    customToken = sqliteDb.prepare("SELECT * FROM tokens WHERE token = ? AND status = 'active'").get(cleanToken) || null;
  }
  if (customToken) return customToken;

  // 2. Check office secret keys in offices table
  let office = null;
  if (useJsonFallback) {
    office = jsonStore.offices.find(o => o.secret_key === cleanToken && o.status === 'active') || null;
  } else {
    office = sqliteDb.prepare("SELECT * FROM offices WHERE secret_key = ? AND status = 'active'").get(cleanToken) || null;
  }

  if (office) {
    return {
      id: 'tok_' + office.id,
      token: office.secret_key,
      name: office.name,
      office_id: office.id,
      allowed_office_ids: office.id,
      status: office.status
    };
  }

  return null;
}

function createToken({ name, allowed_office_ids = 'all', status = 'active' }) {
  const id = 'tok_' + crypto.randomBytes(6).toString('hex');
  const token = 'sflm_' + crypto.randomBytes(24).toString('hex');
  const now = new Date().toISOString();

  if (useJsonFallback) {
    const t = { id, token, name, allowed_office_ids, status, created_at: now };
    jsonStore.tokens.push(t);
    saveJsonStore();
    return t;
  }

  sqliteDb.prepare(`
    INSERT INTO tokens (id, token, name, allowed_office_ids, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, token, name, allowed_office_ids, status, now);

  return { id, token, name, allowed_office_ids, status, created_at: now };
}

function updateToken(id, { name, allowed_office_ids, status }) {
  if (useJsonFallback) {
    const idx = jsonStore.tokens.findIndex(t => t.id === id);
    if (idx === -1) return null;
    if (name !== undefined) jsonStore.tokens[idx].name = name;
    if (allowed_office_ids !== undefined) jsonStore.tokens[idx].allowed_office_ids = allowed_office_ids;
    if (status !== undefined) jsonStore.tokens[idx].status = status;
    saveJsonStore();
    return jsonStore.tokens[idx];
  }
  const current = sqliteDb.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
  if (!current) return null;

  sqliteDb.prepare(`
    UPDATE tokens SET
      name = ?,
      allowed_office_ids = ?,
      status = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name : current.name,
    allowed_office_ids !== undefined ? allowed_office_ids : current.allowed_office_ids,
    status !== undefined ? status : current.status,
    id
  );
  return sqliteDb.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
}

function deleteToken(id) {
  if (useJsonFallback) {
    jsonStore.tokens = jsonStore.tokens.filter(t => t.id !== id);
    saveJsonStore();
    return true;
  }
  sqliteDb.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  return true;
}

// ---------------- Audit Logs ---------------- //
function addAuditLog({ account_id, office_name, display_name, token_name, ip, user_agent, status }) {
  const now = new Date().toISOString();
  if (useJsonFallback) {
    const log = {
      id: jsonStore.audit_logs.length + 1,
      timestamp: now,
      account_id,
      office_name,
      display_name,
      token_name,
      ip,
      user_agent,
      status
    };
    jsonStore.audit_logs.unshift(log);
    if (jsonStore.audit_logs.length > 500) jsonStore.audit_logs.pop();
    saveJsonStore();
    return log;
  }

  sqliteDb.prepare(`
    INSERT INTO audit_logs (timestamp, account_id, office_name, display_name, token_name, ip, user_agent, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(now, account_id || '', office_name || '', display_name || '', token_name || '', ip || '', user_agent || '', status);
}

function getAuditLogs(limit = 100) {
  if (useJsonFallback) {
    return jsonStore.audit_logs.slice(0, limit);
  }
  return sqliteDb.prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?`).all(limit);
}

module.exports = {
  init,
  getSetting,
  setSetting,
  getAllSettings,
  getOffices,
  getOffice,
  createOffice,
  updateOffice,
  regenerateOfficeSecretKey,
  deleteOffice,
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getTokens,
  getTokenByValue,
  createToken,
  updateToken,
  deleteToken,
  addAuditLog,
  getAuditLogs
};
