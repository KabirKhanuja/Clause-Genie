export default function authMiddleware(req, res, next) {
  // adding simple pass-through for now
  // later validate JWT or API Key: req.headers.authorization
  return next();
}