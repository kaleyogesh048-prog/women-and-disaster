const jwt = require('jsonwebtoken');
const config = require('./config');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// lets us use async functions in routes without try/catch everywhere
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please login first'));
  try {
    req.phone = jwt.verify(token, config.jwtSecret).phone;
    next();
  } catch (e) {
    next(new HttpError(401, 'Session expired, please login again'));
  }
}

function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ success: false, error: err.message });
  console.error(err);
  res.status(500).json({ success: false, error: 'Something went wrong on the server' });
}

module.exports = { HttpError, wrap, auth, errorHandler };
