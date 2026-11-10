const ApiError = require('./ApiError');
const endpoint =
  (handler, status = 200) =>
  async (req, res, next) => {
    try {
      res.status(status).json(await handler(req));
    } catch (error) {
      next(error);
    }
  };
function field(value, name, max, optional = false) {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ApiError(400, 'Enter a valid ' + name + ' (up to ' + max + ' characters).');
  return value.trim();
}
function dateOnly(value) {
  if (typeof value !== 'string') throw new ApiError(400, 'Enter a valid calendar date.');
  const date = new Date(String(value) + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    isNaN(date) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new ApiError(400, 'Enter a valid calendar date.');
  return date;
}
module.exports = { endpoint, field, dateOnly };
