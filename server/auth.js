const jwt = require('jsonwebtoken');
const db = require('./database');

// Rate limiting for admin login attempts
const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;

  let record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > windowMs) {
    record = { count: 0, firstAttempt: now };
    loginAttempts.set(ip, record);
  }

  if (record.count >= maxAttempts) {
    const waitMins = Math.ceil((windowMs - (now - record.firstAttempt)) / 60000);
    return res.status(429).json({
      ok: false,
      error: `Too many login attempts. Please try again after ${waitMins} minutes.`
    });
  }

  req.loginAttemptTracker = {
    recordFailure: () => {
      record.count += 1;
    },
    reset: () => {
      loginAttempts.delete(ip);
    }
  };

  next();
}

function getJwtSecret() {
  let secret = db.getSetting('jwt_secret');
  if (!secret) {
    secret = 'sflm_fallback_secret_key_987654321';
  }
  return secret;
}

function signAdminToken(username) {
  const secret = getJwtSecret();
  return jwt.sign({ username, role: 'admin' }, secret, { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Admin authentication token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Token is expired or invalid.' });
  }
}

function requireExtensionToken(req, res, next) {
  const tokenVal = req.headers['x-extension-token'] || req.query.token;
  if (!tokenVal) {
    return res.status(401).json({ ok: false, error: 'Missing X-Extension-Token header' });
  }

  const tokenRecord = db.getTokenByValue(tokenVal);
  if (!tokenRecord) {
    return res.status(403).json({ ok: false, error: 'Invalid or revoked extension access token' });
  }

  req.extensionToken = tokenRecord;
  next();
}

module.exports = {
  rateLimitLogin,
  signAdminToken,
  requireAdmin,
  requireExtensionToken
};
