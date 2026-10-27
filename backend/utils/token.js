const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function getSecret() {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not set in .env');
  }
  return process.env.AUTH_SECRET;
}

const sign = (data) => crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

// Token format: base64url(JSON payload) + '.' + HMAC-SHA256 signature. Payload: { sub, role, exp }.
function createToken(userId, role) {
  const payload = { sub: userId, role, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

// Returns the payload, or null when the token is malformed, tampered with or expired.
function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

module.exports = { createToken, verifyToken };
