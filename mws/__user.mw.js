module.exports = (injectable) => {
    const { managers } = injectable;
    const logger = managers.logger

    return async ({req, res, next}) => {
        try {
            if (!req.user) {
                req.user = { id: 'anonymous', role: 'guest', userId: null };
            }
            
            next(req.user);
        } catch (error) {
            logger.error('❌ __user middleware error:', error);
            req.user = { id: 'anonymous', role: 'guest', userId: null };
            next();
        }
    };
};