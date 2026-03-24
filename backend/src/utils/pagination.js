function paginate(query, { page = 1, limit = 50, maxLimit = 200 }) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit) || 50));
  const offset = (p - 1) * l;
  return {
    paginatedQuery: `${query} LIMIT ${l} OFFSET ${offset}`,
    page: p,
    limit: l,
    offset,
  };
}

function paginatedResponse(rows, total, page, limit) {
  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    }
  };
}

module.exports = { paginate, paginatedResponse };
