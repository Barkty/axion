const Joi = require('joi');

module.exports = class SchoolManager {
  // Exposed HTTP methods
  static httpExposed = [
    'create=post',
    'get=get',
    'list=get',
    'update=put',
    'delete=delete',
    'getStats=get'
  ];

  // Validation schemas
  static validationSchemas = {
    create: Joi.object({
      name: Joi.string().required().min(3).max(100),
      code: Joi.string().required().pattern(/^[A-Z0-9-]+$/),
      address: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required()
      }),
      contact: Joi.object({
        email: Joi.string().email(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/),
        website: Joi.string().uri()
      }),
      settings: Joi.object({
        maxClassrooms: Joi.number().min(1).max(1000),
        maxStudentsPerClass: Joi.number().min(1).max(100),
        academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/)
      })
    }),
    update: Joi.object({
      name: Joi.string().min(3).max(100),
      address: Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        zipCode: Joi.string(),
        country: Joi.string()
      }),
      contact: Joi.object({
        email: Joi.string().email(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/),
        website: Joi.string().uri()
      }),
      settings: Joi.object({
        maxClassrooms: Joi.number().min(1).max(1000),
        maxStudentsPerClass: Joi.number().min(1).max(100),
        academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/)
      }),
      status: Joi.string().valid('active', 'inactive', 'suspended')
    })
  };

  constructor(injectable) {
    this.database = injectable.database;
    this.models = injectable.mongomodels;
    this.Classroom = this.models.Classroom;
    this.School = this.models.School;
    this.Student = this.models.Student;
    this.cache = injectable.cache;
    this.cortex = injectable.cortex;
    this.config = injectable.config;
    this.logger = injectable.managers.logger;
    this.permissions = injectable.managers.permissions;

    this.httpExposed = SchoolManager.httpExposed;

    this.eventHandlers = {
      created: async ({ schoolId, createdBy, timestamp }) => {
        this.logger.info(`[school.created] schoolId=${schoolId} by=${createdBy} at ${timestamp}`);
        // e.g. provision default settings, notify superadmins
      },

      updated: async ({ schoolId, updatedBy, changes, timestamp }) => {
        this.logger.info(`[school.updated] schoolId=${schoolId} by=${updatedBy} changes=${changes} at ${timestamp}`);
        // e.g. audit log, sync to external directory
      },

      deleted: async ({ schoolId, deletedBy, timestamp }) => {
        this.logger.info(`[school.deleted] schoolId=${schoolId} by=${deletedBy} at ${timestamp}`);
        // e.g. cascade cleanup, revoke all associated user access
      }
    };
  }

  async _emit(fnName, args) {
    try {
      await this.cortex.AsyncEmitToOneOf({
        type: this.config.dotEnv.CORTEX_TYPE,
        call: `school.${fnName}`,
        args
      });
    } catch (err) {
      this.logger.error(`[cortex._emit] Failed to emit school.${fnName}:`, err.message);
    }
  }

  // Create school (superadmin only)
  async create({__shark, __user, data: value }) {

    const { error } = SchoolManager.validationSchemas.create.validate(value);
    if (error) throw new Error(`Validation error: ${error.message}`);
    
    this.permissions.check(__user, 'schools', 'create')

    const existingSchool = await this.School.findOne({ code: value.code });
    if (existingSchool) {
      this.logger.error('School code already exists');
      throw new Error('School code already exists');
    }

    const school = await this.School.create({
      ...value,
      createdBy: __user.id,
      status: 'active'
    });

    await this._emit('created', {
      schoolId: school._id,
      createdBy: __user.id,
      timestamp: new Date()
    });

    await this.cache.key.delete({key: 'schools:list:*'});

    return school;
  }

  // Get school by ID
  async get({__shark, __user, params}) {
    const schoolId = params.id;
    
    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== schoolId) {
      throw new Error('Access denied');
    }

    const cacheKey = `school:${schoolId}`;
    const cached = await this.cache.key.get({key: cacheKey});
    if (cached) return JSON.parse(cached);

    const school = await this.School.findById(schoolId);
    if (!school) throw new Error('School not found');

    await this.cache.key.set({key: cacheKey, ttl: 300, data: JSON.stringify(school) });

    return school;
  }

  // List schools with filters (superadmin only or school admin sees own)
  async list({__shark, __user, query}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    
    if (__user.role !== 'superadmin') {
      filter._id = __user.schoolId;
    }

    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { code: new RegExp(query.search, 'i') }
      ];
    }

    const cacheKey = `schools:list:${JSON.stringify(filter)}:${page}:${limit}`;
    const keyExists = await this.cache.key.exists({ key: cacheKey })

    if (keyExists) {
      const cached = await this.cache.key.get({key: cacheKey});
      if (cached) return JSON.parse(cached);
    }

    const [schools, total] = await Promise.all([
      this.School.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      this.School.countDocuments(filter)
    ]);

    const result = {
      data: schools,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await this.cache.key.set({ key: cacheKey, ttl: 120, data: JSON.stringify(result) });

    return result;
  }

  // Update school
  async update({__shark, __user, params, data: value }) {
    const schoolId = params.id;
      
    const { error } = SchoolManager.validationSchemas.update.validate(value);
    if (error) throw new Error(`Validation error: ${error.message}`);

    
    const school = await this.School.findById(schoolId);
    if (!school) throw new Error('School not found');
    
    this.permissions.checkWithScope(__user, 'schools', 'update', school._id);

    Object.assign(school, value);
    school.updatedAt = new Date();
    await school.save();

    await this.cache.key.delete({key: `school:${schoolId}`});
    await this.cache.key.delete({key: 'schools:list:*'});

    await this._emit('updated', {
      schoolId: school._id,
      updatedBy: __user.id,
      changes: Object.keys(value),
      timestamp: new Date()
    });

    return school;
  }

  // Delete school (soft delete)
  async delete({__shark, __user, params}) {
    const schoolId = params.id;

    this.permissions.check(__user, 'schools', 'delete')

    const school = await this.School.findById(schoolId);
    if (!school) throw new Error('School not found');

    const [activeClassrooms, activeStudents] = await Promise.all([
      this.Classroom.countDocuments({ schoolId, status: 'active' }),
      this.Student.countDocuments({ schoolId, 'enrollment.status': 'enrolled' })
    ]);

    if (activeClassrooms > 0 || activeStudents > 0) {
      throw new Error('Cannot delete school with active classrooms or students');
    }

    school.deletedAt = new Date();
    await school.save();

    await this.cache.key.delete({key: `school:${schoolId}`});
    await this.cache.key.delete({key: 'schools:list:*'});

    await this._emit('deleted', {
      schoolId: school._id,
      deletedBy: __user.id,
      timestamp: new Date()
    });

    return { message: 'School deleted successfully' };
  }

  // Get school statistics
  async getStats({__shark, __user, params}) {
    const schoolId = params.id;

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== schoolId) {
      throw new Error('Access denied');
    }

    const cacheKey = `school:stats:${schoolId}`;
    const cached = await this.cache.key.get({key: cacheKey});
    if (cached) return JSON.parse(cached);

    const stats = await this.School.aggregate([
      { $match: { _id: this.database.Types.ObjectId(schoolId) } },
      {
        $lookup: {
          from: 'classrooms',
          localField: '_id',
          foreignField: 'schoolId',
          as: 'classrooms'
        }
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'schoolId',
          as: 'students'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'schoolId',
          as: 'staff'
        }
      },
      {
        $project: {
          totalClassrooms: { $size: '$classrooms' },
          activeClassrooms: {
            $size: {
              $filter: {
                input: '$classrooms',
                as: 'c',
                cond: { $eq: ['$$c.status', 'active'] }
              }
            }
          },
          totalStudents: { $size: '$students' },
          enrolledStudents: {
            $size: {
              $filter: {
                input: '$students',
                as: 's',
                cond: { $eq: ['$$s.enrollment.status', 'enrolled'] }
              }
            }
          },
          totalStaff: { $size: '$staff' },
          classroomUtilization: {
            $avg: {
              $map: {
                input: '$classrooms',
                as: 'c',
                in: {
                  $multiply: [
                    { $divide: ['$$c.currentEnrollment', '$$c.capacity'] },
                    100
                  ]
                }
              }
            }
          }
        }
      }
    ]);

    await this.cache.key.set({key: cacheKey, ttl: 300, data: JSON.stringify(stats[0])});

    return stats[0];
  }
}