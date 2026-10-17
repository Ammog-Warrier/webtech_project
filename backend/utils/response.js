// All API responses: { success, data } or { success: false, error: { message } }
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const ok = (res, data, status = 200) => sendJson(res, status, { success: true, data });
const fail = (res, status, message) =>
  sendJson(res, status, { success: false, error: { message } });

module.exports = { sendJson, ok, fail };
