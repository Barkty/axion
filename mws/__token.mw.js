module.exports = ({ meta, config, managers }) =>{
    return ({req, res, next})=>{
        const exposedApi = managers.exposedApi;
        if (exposedApi.includes(req.url)) {
            return next()
        }
        if(!req.headers.token){
            return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
        }
        let decoded = null
        try {
            decoded = managers.token.verifyShortToken({ token: req.headers.token });
            if(!decoded){
                return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
            };

            req.user = { ...decoded, id: decoded.userId }
        } catch(err){
            return managers.responseDispatcher.dispatch(res, {ok: false, code:401, errors: 'unauthorized'});
        }
    
        next();
    }
}