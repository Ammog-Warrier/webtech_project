// Settings a super admin may change. Only keys listed here can be edited, each with its own validation.
// validate(value) returns the normalised string to store, or throws a 400 error.
const bad = (message) => Object.assign(new Error(message), { status: 400 });

const SETTING_RULES = {
  maintenance_mode: {
    validate(value) {
      const text = String(value).toLowerCase();
      if (text !== 'true' && text !== 'false') throw bad('maintenance_mode must be true or false');
      return text;
    },
  },
  booking_cancellation_hours_limit: {
    validate(value) {
      const text = String(value).trim();
      if (!/^\d+$/.test(text) || Number(text) > 720) {
        throw bad('booking_cancellation_hours_limit must be a whole number of hours from 0 to 720');
      }
      return String(Number(text));
    },
  },
};

module.exports = { SETTING_RULES };
