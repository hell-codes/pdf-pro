const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/config');
const { ensureDirectories } = require('../server/utils/fileUtils');
const { scheduleCleanup } = require('./utils/cleanupTemp');
const pdfRoutes = require('./routes/pdfRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // the demo frontend uses inline styles/scripts freely
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(cors({ origin: config.corsOrigins }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
});
app.use('/api', apiLimiter);

app.use(express.static(config.paths.public, { extensions: ['html'] }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PDF Pro API is running.', timestamp: new Date().toISOString() });
});
app.use('/api/pdf', pdfRoutes);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(config.paths.public, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await ensureDirectories();
  scheduleCleanup();
  app.listen(config.port, () => {
    console.log(`\n  PDF Pro server running → http://localhost:${config.port}`);
    console.log(`  Environment: ${config.env}\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start PDF Pro server:', err);
  process.exit(1);
});

module.exports = app;
