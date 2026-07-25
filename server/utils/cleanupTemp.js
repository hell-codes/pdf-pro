const config = require('../config/config');
const { purgeOldFiles } = require('./fileUtils');

async function runCleanup() {
  await Promise.all([
    purgeOldFiles(config.paths.uploads, config.fileRetentionMs),
    purgeOldFiles(config.paths.converted, config.fileRetentionMs),
    purgeOldFiles(config.paths.temp, config.fileRetentionMs),
  ]);
}

function scheduleCleanup(intervalMs = 30 * 60 * 1000) {
  runCleanup().catch((err) => console.error('[cleanup] initial run failed:', err.message));
  return setInterval(() => {
    runCleanup().catch((err) => console.error('[cleanup] run failed:', err.message));
  }, intervalMs);
}

if (require.main === module) {
  runCleanup()
    .then(() => {
      console.log('[cleanup] Old files purged.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cleanup] Failed:', err);
      process.exit(1);
    });
}

module.exports = { runCleanup, scheduleCleanup };
