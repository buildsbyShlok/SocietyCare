const { ROLES } = require('../utils/constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the registration request body.
 *
 * @param {object} data
 * @returns {string[]} Array of error messages. Empty means valid.
 */
function validateRegister(data) {
  const errors = [];

  if (typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  if (typeof data.email !== 'string' || !EMAIL_REGEX.test(data.email)) {
    errors.push('A valid email address is required');
  }

  if (typeof data.password !== 'string' || data.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (typeof data.name === 'string' && data.name.trim().length > 100) errors.push('Name must not exceed 100 characters');
  if (typeof data.email === 'string' && data.email.length > 254) errors.push('Email must not exceed 254 characters');
  if (typeof data.flatNumber === 'string' && data.flatNumber.trim().length > 40) errors.push('Flat number must not exceed 40 characters');
  if (typeof data.password === 'string' && Buffer.byteLength(data.password, 'utf8') > 72) errors.push('Password must not exceed 72 UTF-8 bytes');
  if (data.phone != null && (typeof data.phone !== 'string' || data.phone.length > 30)) errors.push('Phone must be text up to 30 characters');
  if (['societyId','disabled','enrollmentPending'].some(key => key in data))
    errors.push('Account access fields cannot be set at registration');
  if (data.qrToken !== undefined && (typeof data.qrToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.qrToken)))
    errors.push('Invalid equipment label');
  if (data.role && data.role !== ROLES.RESIDENT) {
    errors.push('Registration should never allow selecting ADMIN');
  }

  if (typeof data.flatNumber !== 'string' || data.flatNumber.trim().length === 0) {
    errors.push('Flat number is required');
  }

  return errors;
}

/**
 * Validates the login request body.
 *
 * @param {object} data
 * @returns {string[]} Array of error messages. Empty means valid.
 */
function validateLogin(data) {
  const errors = [];

  if (typeof data.email !== 'string' || !EMAIL_REGEX.test(data.email)) {
    errors.push('A valid email address is required');
  }

  if (typeof data.password !== 'string' || data.password.length === 0) {
    errors.push('Password is required');
  }

  return errors;
}

module.exports = { validateRegister, validateLogin };
