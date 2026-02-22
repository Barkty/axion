const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const md5 = require('md5');

module.exports = class TokenManager {

    constructor({ config, cache } = {}) {
        this.config = config;
        this.cache = cache;
        
        this.longTokenExpiresIn = config.dotEnv.LONG_TOKEN_EXPIRY || '30d';
        this.shortTokenExpiresIn = config.dotEnv.SHORT_TOKEN_EXPIRY || '24h';
        
        this.httpExposed = ['v1_createShortToken'];
    }

    /**
     * Generate long-lived token (refresh token)
     * Original method - kept for backward compatibility
     */
    genLongToken({ userId, userKey, ...extraPayload }, expiry = this.longTokenExpiresIn) {
        return jwt.sign(
            {
                userKey,
                userId,
                tokenType: 'long',
                ...extraPayload
            },
            this.config.dotEnv.LONG_TOKEN_SECRET,
            { expiresIn: expiry }
        );
    }

    /**
     * Generate short-lived token (access token)
     * Original method - kept for backward compatibility
     */
    genShortToken({ userId, userKey, sessionId, deviceId, ...extraPayload }, expiry = this.shortTokenExpiresIn) {
        return jwt.sign(
            {
                userKey,
                userId,
                sessionId: sessionId || nanoid(),
                deviceId: deviceId || md5('default-device'),
                tokenType: 'short',
                ...extraPayload
            },
            this.config.dotEnv.SHORT_TOKEN_SECRET,
            { expiresIn: expiry }
        );
    }

    /**
     * Verify token with specified secret
     */
    _verifyToken({ token, secret }) {
        let decoded = null;
        try {
            decoded = jwt.verify(token, secret);
        } catch (err) {
            console.log('Token verification error:', err.message);
        }
        return decoded;
    }

    /**
     * Verify long token
     */
    verifyLongToken({ token }) {
        return this._verifyToken({
            token,
            secret: this.config.dotEnv.LONG_TOKEN_SECRET
        });
    }

    /**
     * Verify short token
     */
    verifyShortToken({ token }) {
        return this._verifyToken({
            token,
            secret: this.config.dotEnv.SHORT_TOKEN_SECRET
        });
    }

    /**
     * Generate short token from long token (original method)
     */
    v1_createShortToken({ __longToken, __device }) {
        let decoded = __longToken;

        let shortToken = this.genShortToken({
            userId: decoded.userId,
            userKey: decoded.userKey,
            sessionId: nanoid(),
            deviceId: md5(__device || 'unknown-device'),
        });

        return { shortToken };
    }

    /**
     * Generate access token for user
     * @param {Object} user - User object
     * @param {string} deviceId - Device identifier
     * @param {string} expiry - Optional custom expiry
     */
    generateAccessToken(user, deviceId = 'default', expiry = this.shortTokenExpiresIn) {
        const payload = {
            userId: user._id || user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId || null,
            userKey: user.userKey || nanoid(),
            tokenType: 'access'
        };

        return this.genShortToken({
            ...payload,
            deviceId: md5(deviceId),
            sessionId: nanoid()
        }, expiry);
    }

    /**
     * Generate refresh token for user
     * @param {Object} user - User object
     * @param {string} expiry - Optional custom expiry
     */
    generateRefreshToken(user, expiry = this.longTokenExpiresIn) {
        const payload = {
            userId: user._id || user.id,
            userKey: user.userKey || nanoid(),
            tokenType: 'refresh'
        };

        return this.genLongToken(payload, expiry);
    }

    /**
     * Generate both access and refresh tokens
     */
    generateTokenPair(user, deviceId = 'default', rememberMe = false) {
        const accessTokenExpiry = rememberMe ? '7d' : '24h';
        const refreshTokenExpiry = rememberMe ? '30d' : '7d';

        const accessToken = this.generateAccessToken(user, deviceId, accessTokenExpiry);
        const refreshToken = this.generateRefreshToken(user, refreshTokenExpiry);

        // Store refresh token in cache for validation/revocation
        const refreshTokenId = md5(refreshToken);
        this.cache.key.set({
            key: `refresh:${refreshTokenId}`,
            ttl: 30 * 24 * 60 * 60, // 30 days
            data: JSON.stringify({
                userId: user._id || user.id,
                deviceId: md5(deviceId),
                valid: true
            })
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: rememberMe ? 604800 : 86400 // 7 days or 24 hours in seconds
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        const decoded = this.verifyShortToken({ token });
        if (!decoded || decoded.tokenType !== 'short') {
            return null;
        }

        return decoded;
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        const decoded = this.verifyLongToken({ token });
        
        if (!decoded || decoded.tokenType !== 'long') {
            return null;
        }

        // Check if refresh token is still valid in cache
        const refreshTokenId = md5(token);
        return this.cache.key.get({ key: `refresh:${refreshTokenId}`})
            .then(stored => {
                if (!stored) return null;
                return decoded;
            });
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken, deviceId = 'default') {
        // Verify refresh token
        const decoded = await this.verifyRefreshToken(refreshToken);
        
        if (!decoded) {
            throw new Error('Invalid or expired refresh token');
        }

        // Generate new access token
        const accessToken = this.generateAccessToken(
            { id: decoded.userId, ...decoded },
            deviceId,
            '24h'
        );

        return { accessToken };
    }

    /**
     * Revoke refresh token (logout)
     */
    async revokeRefreshToken(refreshToken) {
        const refreshTokenId = md5(refreshToken);
        await this.cache.key.delete({key: `refresh:${refreshTokenId}`});
        
        // Also blacklist the token itself
        await this.cache.key.set({ key: `blacklist:${refreshToken}`, ttl: 24 * 60 * 60, data: 'revoked'});
        
        return true;
    }

    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllUserTokens(userId) {
        const pattern = `refresh:*`;
        const keys = await this.cache.keys({ key: pattern});
        
        const promises = keys.map(async (key) => {
            const data = await this.cache.key.get({key});
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.userId === userId) {
                    await this.cache.key.delete({key});
                }
            }
        });
        
        await Promise.all(promises);
        
        // Also invalidate by user ID pattern
        await this.cache.key.set({ key: `user:${userId}:token_invalid`, ttl: 24 * 60 * 60, data: 'true'});
        
        return true;
    }

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(token) {
        const blacklisted = await this.cache.key.get({key: `blacklist:${token}`});
        return !!blacklisted;
    }

    /**
     * Decode token without verification
     */
    decodeToken(token) {
        return jwt.decode(token);
    }

    /**
     * Extract token from authorization header
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader) return null;
        
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            return parts[1];
        }
        
        return null;
    }

    /**
     * Get token expiration time
     */
    getTokenExpiration(token) {
        const decoded = this.decodeToken(token);
        return decoded ? decoded.exp : null;
    }

    /**
     * Check if token is expired
     */
    isTokenExpired(token) {
        const exp = this.getTokenExpiration(token);
        if (!exp) return true;
        
        const now = Math.floor(Date.now() / 1000);
        return exp < now;
    }
};