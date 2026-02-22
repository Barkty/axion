const layers = {
    board: {

        /** all board are public by default */
        _default: { anyoneCan: 'read', ownerCan: 'audit' },
        _public:  { anyoneCan: 'create', ownerCan: 'audit' },
        _private: { anyoneCan: 'none' },
        _store:   { anyoneCan: 'read', noOneCan: 'create' },

        post: {

            _default: { inherit: true }, 
            _public:  { inherit: true },
            _private: { inherit: true },
            
            comment: {
                _default: { inherit: true }, 
                reply: {
                    _default: {inherit: true},
                    vote: {
                        _default: {anyoneCan: 'create'},
                    },
                },
                vote: {
                    _default: {anyoneCan: 'create'},
                },
            },
            vote: {
                _default: {anyoneCan: 'create'},
            },
            sticker: {
                _default: {inherit: true},
            }
        }
    },

    superadmin: {
        name: 'Super Administrator',
        permissions: {
            users: { list: true, create: true, update: true, delete: true, view: true, assign_role: true },
            schools: { list: true, create: true, update: true, delete: true, view: true },
            classrooms: { list: true, create: true, update: true, delete: true, view: true },
            students: { list: true, create: true, update: true, delete: true, view: true, transfer: true }
        }
    },
    school_admin: {
        name: 'School Administrator',
        permissions: {
            users: { list: true, create: true, update: true, view: true },
            schools: { view: true, update: true },
            classrooms: { list: true, create: true, update: true, delete: true, view: true },
            students: { list: true, create: true, update: true, view: true, transfer: true }
        }
    },
    teacher: {
        name: 'Teacher',
        permissions: {
            users: { view: true },
            classrooms: { view: true, list: true },
            students: { list: true, view: true }
        }
    },
    student: {
        name: 'Student',
        permissions: {
            users: { view: true },
            students: { view: true }
        }
    }
}


const actions = {
    users: ['list', 'create', 'update', 'delete', 'view', 'assign_role'],
    schools: ['list', 'create', 'update', 'delete', 'view'],
    logs: ['list', 'create', 'update', 'delete', 'view'],
    classrooms: ['list', 'create', 'update', 'delete', 'view'],
    students: ['list', 'create', 'update', 'delete', 'view', 'transfer']
};


module.exports = {
    layers,
    actions
}