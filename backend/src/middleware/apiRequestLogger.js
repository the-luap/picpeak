const logger = require('../utils/logger');
const { requestLogPath } = require('../utils/requestLogPath');
module.exports = function apiRequestLogger(req, res, next) {
  const started = Date.now();
  const path = requestLogPath(req.originalUrl);
  logger.info(`${req.method} ${path}`);
  res.once('finish', () => {
    logger.info(`${req.method} ${path} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
};
