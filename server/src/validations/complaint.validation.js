const { CATEGORY, PRIORITY } = require('../utils/constants');

const VALID_CATEGORIES = Object.values(CATEGORY);
const VALID_PRIORITIES = Object.values(PRIORITY);

/**
 * Validates the create complaint request body.
 * Note: photo validation is handled by Multer (MIME type and file size).
 *
 * @param {object} data
 * @returns {string[]} Array of error messages. Empty means valid.
 */
function validateCreateComplaint(data) {
  const errors = [];
  const qr = data.qrToken !== undefined;
  if (qr && (typeof data.qrToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.qrToken)))
    errors.push('Invalid QR token. Scan the equipment label again.');
  if (qr && Object.keys(data).some(key => !['qrToken', 'title', 'description', 'priority'].includes(key)))
    errors.push('QR reports accept only the token, issue title, description and priority.');
  if (!qr && ['assetId', 'source', 'societyId', 'residentId', 'userId'].some(key => key in data))
    errors.push('The reporting identity, source and asset cannot be supplied manually.');

  if (typeof data.title !== 'string' || data.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters');
  }

  if (typeof data.title === 'string' && data.title.trim().length > 100) {
    errors.push('Title must not exceed 100 characters');
  }

  if (typeof data.description !== 'string' || data.description.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  if (typeof data.description === 'string' && data.description.trim().length > 2000) {
    errors.push('Description must not exceed 2000 characters');
  }

  if (!qr && (!data.category || !VALID_CATEGORIES.includes(data.category))) {
    errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (!data.priority || !VALID_PRIORITIES.includes(data.priority)) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  return errors;
}

/**
 * Validates the update complaint status request body.
 * Transition validity is enforced in complaint.service.js using ALLOWED_STATUS_TRANSITIONS.
 *
 * @param {object} data
 * @returns {string[]} Array of error messages. Empty means valid.
 */
function validateUpdateStatus(data) {
  const errors = [];

  const { STATUS, PRIORITY } = require('../utils/constants');
  const VALID_STATUSES = Object.values(STATUS);
  const VALID_PRIORITIES = Object.values(PRIORITY);

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  if (data.remark != null && (typeof data.remark !== 'string' || data.remark.length > 2000)) errors.push('Remark must be text up to 2000 characters');
  if (!data.status && !data.priority) {
    errors.push('At least one of status or priority override must be provided');
  }

  return errors;
}

module.exports = { validateCreateComplaint, validateUpdateStatus };
