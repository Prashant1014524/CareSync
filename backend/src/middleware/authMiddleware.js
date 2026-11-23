const jwt = require('jsonwebtoken');

const developmentSecret = 'healthcare-jwt-secret-key-2026';
const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' &&
    (!configuredSecret || configuredSecret.trim().length < 32 || configuredSecret === developmentSecret)) {
  throw new Error('Set JWT_SECRET to a unique secret of at least 32 characters.');
}
const JWT_SECRET = configuredSecret || developmentSecret;

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET,
};
