// Simple in-memory brute-force protection for login: after MAX_FAILURES wrong attempts for the same
// client address and email within WINDOW_MS, further attempts are refused until the window ends.
// State is kept in memory, so it resets when the server restarts.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map(); // key -> { count, firstAt }

function prune(now) {
  for (const [key, entry] of failures) {
    if (now - entry.firstAt > WINDOW_MS) failures.delete(key);
  }
}

function isLocked(key) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key) {
  const now = Date.now();
  prune(now);
  const entry = failures.get(key);
  if (!entry) failures.set(key, { count: 1, firstAt: now });
  else entry.count += 1;
}

function clearFailures(key) {
  failures.delete(key);
}

module.exports = { isLocked, recordFailure, clearFailures };
