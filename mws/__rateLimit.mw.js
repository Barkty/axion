module.exports = (injectable) => {
  const { config, cache, managers } = injectable;

  return async ({req, res, next}) => {
    const key = `rate_limit:${req.ip}`;
    const limit = config.rateLimit?.max || 100;
    const windowMs = config.rateLimit?.windowMs || 15 * 60 * 1000; // 15 minutes

    try {
      const current = await cache.incr(key);
      
      if (current === 1) {
        await cache.expire(key, Math.ceil(windowMs / 1000));
      }

      if (current > limit) {
        return managers.responseDispatcher.dispatch(res, {ok: false, code:429, errors: 'Too many requests, please try again later'})
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + (windowMs / 1000)));

      next();
    } catch (err) {
      next(err);
    }
  };
};