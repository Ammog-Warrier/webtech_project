const { pool } = require('../config/db');
const { SETTING_RULES } = require('../utils/settings');

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function listSettings() {
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value, description,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM settings ORDER BY setting_key`
  );
  return rows;
}

async function getSetting(key) {
  const [rows] = await pool.execute(
    `SELECT setting_key, setting_value, description,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM settings WHERE setting_key = ?`,
    [key]
  );
  return rows[0] || null;
}

// Updates an existing, editable setting. Returns { setting, previous }.
async function updateSetting(key, value) {
  const rule = SETTING_RULES[key];
  const current = await getSetting(key);
  if (!current || !rule) throw httpError(404, 'Setting not found');
  if (value === undefined || value === null || typeof value === 'object') {
    throw httpError(400, 'value is required');
  }
  const normalised = rule.validate(value);
  await pool.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [normalised, key]);
  maintenanceCache.at = 0; // apply a maintenance_mode change immediately
  return { setting: await getSetting(key), previous: current.setting_value };
}

// maintenance_mode is read on every API request, so it is cached for a few seconds.
const maintenanceCache = { value: false, at: 0 };
const CACHE_MS = 5000;

async function isMaintenanceMode() {
  if (Date.now() - maintenanceCache.at < CACHE_MS) return maintenanceCache.value;
  try {
    const setting = await getSetting('maintenance_mode');
    maintenanceCache.value = Boolean(setting) && setting.setting_value === 'true';
  } catch {
    maintenanceCache.value = false;
  }
  maintenanceCache.at = Date.now();
  return maintenanceCache.value;
}

module.exports = { listSettings, getSetting, updateSetting, isMaintenanceMode };
