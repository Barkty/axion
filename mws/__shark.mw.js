module.exports = (injectable) => {
    const { managers } = injectable;
    const sharkFin = managers.shark;
    const logger = managers.logger;

    return async ({req, res, next}) => {
         try {
            logger.info('🦈 __shark middleware running');
            
            // Validate sharkFin exists
            if (!sharkFin) {
                logger.warn('⚠️ sharkFin not available in __shark middleware');
                req.shark = {
                    isGranted: async () => true,
                    getLayers: () => ({})
                };
                return next();
            }
            
            req.shark = sharkFin;
            
            req.checkPermission = async (layer, action, nodeId) => {
                if (!req.user || !req.user.userId) return false;
                
                try {
                    return await sharkFin.isGranted({
                        userId: req.user.userId,
                        layer,
                        action,
                        nodeId,
                        isOwner: false
                    });
                } catch (err) {
                    logger.error('Permission check error:', err);
                    return false;
                }
            };
            
            logger.info('🦈 Shark attached to request');
            next();
            
        } catch (error) {
            console.error('❌ __shark middleware error:', error);

            req.shark = {
                isGranted: async () => true,
                getLayers: () => ({})
            };

            next();
        }
    };
};