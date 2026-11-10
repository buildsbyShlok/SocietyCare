// Bound user-controlled pagination before passing offsets to Prisma.
function pagination(query = {}, defaultLimit = 10) {
  const integer = (value, fallback, max) => {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : fallback;
  };
  const page = integer(query.page, 1, 10000);
  const limit = integer(query.limit, defaultLimit, 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
module.exports = pagination;
