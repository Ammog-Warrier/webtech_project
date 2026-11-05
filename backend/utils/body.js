const MAX_BYTES = 1e6;

// Reads and parses a JSON request body. Resolves {} when empty; rejects with 400 unless it is a JSON object.
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
      // Every endpoint expects a JSON object; null, arrays, numbers and strings are rejected here.
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject(Object.assign(new Error('Request body must be a JSON object'), { status: 400 }));
      }
      resolve(parsed);
    });
    req.on('error', reject);
  });
}

module.exports = { parseJsonBody };
