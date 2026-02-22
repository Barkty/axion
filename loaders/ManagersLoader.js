const MiddlewaresLoader     = require('./MiddlewaresLoader');
const MongoLoader     = require('./MongoLoader');
const ApiHandler            = require("../managers/api/Api.manager");
const LiveDB                = require('../managers/live_db/LiveDb.manager');
const UserServer            = require('../managers/http/UserServer.manager');
const ResponseDispatcher    = require('../managers/response_dispatcher/ResponseDispatcher.manager');
const VirtualStack          = require('../managers/virtual_stack/VirtualStack.manager');
const ValidatorsLoader      = require('./ValidatorsLoader');
const ResourceMeshLoader    = require('./ResourceMeshLoader');
const utils                 = require('../libs/utils');
const LoggerManager = require('../managers/logger/Logger.manager');

const systemArch            = require('../static_arch/main.system');
const TokenManager          = require('../managers/token/Token.manager');
const SharkFin              = require('../managers/shark_fin/SharkFin.manager');
const TimeMachine           = require('../managers/time_machine/TimeMachine.manager');
const SwaggerLoader = require('./SwaggerLoader');
const PermissionManager = require('../managers/permission/Permission.manager');

/** 
 * load sharable modules
 * @return modules tree with instance of each module
*/
module.exports = class ManagersLoader {
    constructor({ config, cortex, cache, oyster, aeon }) {

        this.managers   = {};
        this.config     = config;
        this.cache      = cache;
        this.cortex     = cortex;
        
        this._preload();
        this.injectable = {
            utils,
            cache, 
            config,
            cortex,
            oyster,
            aeon,
            managers: this.managers, 
            validators: this.validators,
            mongomodels: this.mongomodels,
            resourceNodes: this.resourceNodes,
        };
    }

    _preload(){
        const validatorsLoader    = new ValidatorsLoader({
            models: require('../managers/_common/schema.models'),
            customValidators: require('../managers/_common/schema.validators'),
        });
        const resourceMeshLoader  = new ResourceMeshLoader({})
        const mongoLoader      = new MongoLoader({ schemaExtension: "model.js" });

        this.validators           = validatorsLoader.load();
        this.resourceNodes        = resourceMeshLoader.load();
        this.mongomodels          = mongoLoader.load();

    }

    load() {
        this.managers.responseDispatcher  = new ResponseDispatcher();
        this.managers.liveDb              = new LiveDB(this.injectable);

        this.managers.logger             = new LoggerManager(this.injectable);

        this.injectable.managers         = this.managers;

        const middlewaresLoader           = new MiddlewaresLoader(this.injectable);
        const mwsRepo                     = middlewaresLoader.load();

        const { layers, actions }         = systemArch;
        this.injectable.mwsRepo           = mwsRepo;
        /*****************************************CUSTOM MANAGERS*****************************************/
        this.managers.shark               = new SharkFin({ ...this.injectable, layers, actions });
        this.managers.timeMachine         = new TimeMachine(this.injectable);
        this.managers.token               = new TokenManager(this.injectable);
        this.managers.permissions         = new PermissionManager(this.injectable);

        // Load entity managers with lowercase keys for API routing
        const entityManagers = {
            school: '../managers/entities/school/School.manager',
            classroom: '../managers/entities/classroom/Classroom.manager',
            student: '../managers/entities/student/Student.manager',
            user: '../managers/entities/user/User.manager'
        };
        
        Object.entries(entityManagers).forEach(([key, path]) => {
            try {
                const ManagerClass = require(path);
                this.managers[key] = new ManagerClass(this.injectable);
            } catch (error) {
                console.log(`⚠️ Could not load ${key} manager:`, error.message);
            }
        });

        const swaggerLoader               = new SwaggerLoader(this.injectable);
        this.managers.swagger            = swaggerLoader.load();

        /*************************************************************************************************/
        this.managers.mwsExec             = new VirtualStack({ ...{ preStack: ['__token','__device',] }, ...this.injectable });
        this.managers.userApi             = new ApiHandler({...this.injectable,...{prop:'httpExposed'}});
        this.managers.userServer          = new UserServer({ config: this.config, managers: this.managers });

        this.managers.exposedApi = ['/api/user/login', '/api/user/register', '/api/swagger/ui', '/api/swagger/getUi', '/api/swagger/getJson', '/api/swagger/json'] 
       
        return this.managers;

    }
}
