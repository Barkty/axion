const jwt = require('jsonwebtoken');

module.exports = (injectable) => {
  const { config, cache, database, managers } = injectable;

  return async ({req, res, next}) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'Authentication required'});
      }

      // Check if token is blacklisted
      const isBlacklisted = await cache.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'Token has been revoked'});
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Get user from database
      const user = await database.User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'User not found'});
      }

      if (user.status !== 'active') {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:403, errors: 'Account is not active'});
      }

      // Attach user to request
      req.user = user;
      req.token = token;

      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'Invalid token'});
      }
      if (err.name === 'TokenExpiredError') {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'Token expired'});
      }
      next(err);
    }
  };
};