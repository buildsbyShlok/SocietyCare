/**
 * Validates the create/update notice request body.
 *
 * @param {object} data
 * @returns {string[]} Array of error messages. Empty means valid.
 */
function validateNotice(data) {
  const errors = [];

  if (typeof data.title !== 'string' || data.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  }

  if (typeof data.title === 'string' && data.title.trim().length > 150) {
    errors.push('Title must not exceed 150 characters');
  }

  if (typeof data.content !== 'string' || data.content.trim().length < 10) {
    errors.push('Content must be at least 10 characters');
  }

  if (typeof data.content === 'string' && data.content.trim().length > 5000) {
    errors.push('Content must not exceed 5000 characters');
  }

  if (data.isPinned !== undefined && typeof data.isPinned !== 'boolean') errors.push('Pin setting must be true or false');
  if(data.category !== undefined && !["General","Maintenance","Security","Community"].includes(data.category)) errors.push("Choose a valid notice category");
  return errors;
}

module.exports = { validateNotice };
