const jwt = require('jsonwebtoken');

// Issue fix: routes/index.js imports auth as default function → export it correctly
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ message: 'Admin access required' });
    next();
  });
};

// routes/index.js does:  const auth = require('../middleware/auth');
// So we export auth as the DEFAULT export (module.exports = auth)
// AND attach adminAuth on it as a property
auth.adminAuth = adminAuth;
module.exports = auth;
