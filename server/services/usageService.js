async function checkAllowance(user, requestBytes) {
  return {
    allowed: true,
    reason: null,
    remaining: null,
  };
}

async function recordUsage(user, meta) {
  return true;
}

module.exports = { checkAllowance, recordUsage };
