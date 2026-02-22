const Joi = require('joi');

module.exports = class ClassroomManager {
  static httpExposed = [
    'create=post',
    'get=get',
    'list=get',
    'update=put',
    'delete=delete',
    'assignTeacher=post',
    'getStudents=get'
  ];

  static validationSchemas = {
    create: Joi.object({
      schoolId: Joi.string().required(),
      name: Joi.string().required().min(2).max(50),
      code: Joi.string().required().pattern(/^[A-Z0-9-]+$/),
      grade: Joi.number().required().min(1).max(12),
      section: Joi.string().max(5),
      capacity: Joi.number().required().min(1).max(100),
      resources: Joi.array().items(
        Joi.object({
          type: Joi.string().required(),
          quantity: Joi.number().min(1).default(1)
        })
      ),
      academicYear: Joi.string().pattern(/^\d{4}-\d{4}$/).default(new Date().getFullYear() + '-' + (new Date().getFullYear() + 1))
    }),
    update: Joi.object({
      name: Joi.string().min(2).max(50),
      capacity: Joi.number().min(1).max(100),
      resources: Joi.array().items(
        Joi.object({
          type: Joi.string(),
          quantity: Joi.number().min(1)
        })
      ),
      status: Joi.string().valid('active', 'inactive', 'maintenance')
    })
  };

  constructor(injectable) {
    this.database = injectable.database;
    this.models = injectable.mongomodels;
    this.Classroom = this.models.Classroom;
    this.School = this.models.School;
    this.Student = this.models.Student;
    this.User = this.models.User;
    this.cache = injectable.cache;
    this.cortex = injectable.cortex;
    this.config = injectable.config;
    this.logger = injectable.managers.logger;
    this.permissions = injectable.managers.permissions;

    this.httpExposed = ClassroomManager.httpExposed;

    this.eventHandlers = {
      created: async ({ classroomId, schoolId, createdBy, timestamp }) => {
        this.logger.info(`[classroom.created] classroomId=${classroomId} school=${schoolId} by=${createdBy} at ${timestamp}`);
        // e.g. notify school admin, update school stats cache
      },

      updated: async ({ classroomId, schoolId, updatedBy, changes, timestamp }) => {
        this.logger.info(`[classroom.updated] classroomId=${classroomId} school=${schoolId} by=${updatedBy} changes=${changes} at ${timestamp}`);
        // e.g. audit log, propagate capacity changes downstream
      },

      deleted: async ({ classroomId, schoolId, deletedBy, timestamp }) => {
        this.logger.info(`[classroom.deleted] classroomId=${classroomId} school=${schoolId} by=${deletedBy} at ${timestamp}`);
        // e.g. unassign teacher, notify affected staff
      },

      teacherAssigned: async ({ classroomId, teacherId, assignedBy, timestamp }) => {
        this.logger.info(`[classroom.teacherAssigned] classroomId=${classroomId} teacherId=${teacherId} by=${assignedBy} at ${timestamp}`);
        // e.g. notify teacher, update their profile, send welcome email
      }
    };
  }

  async _emit(fnName, args) {
    try {
      await this.cortex.AsyncEmitToOneOf({
        type: this.config.dotEnv.CORTEX_TYPE,
        call: `classroom.${fnName}`,
        args
      });
    } catch (err) {
      this.logger.error(`[cortex._emit] Failed to emit classroom.${fnName}:`, err.message);
    }
  }

  // Create classroom (school admin only)
  async create({__shark, __user, params, data: value }) {
    const { error } = ClassroomManager.validationSchemas.create.validate(value);
    if (error) throw new Error(`Validation error: ${error.message}`);

    this.permissions.checkWithScope(__user, 'classrooms', 'create', value.schoolId)

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== value.schoolId) {
      throw new Error('Access denied');
    }

    const school = await this.School.findById(value.schoolId);
    if (!school) throw new Error('School not found');

    const classroomCount = await this.Classroom.countDocuments({
      schoolId: value.schoolId,
      deletedAt: null
    });

    if (classroomCount >= school.settings.maxClassrooms) {
      throw new Error('School has reached maximum classroom limit');
    }

    const existingClassroom = await this.Classroom.findOne({
      schoolId: value.schoolId,
      code: value.code
    });
    if (existingClassroom) throw new Error('Classroom code already exists in this school');

    const classroom = await this.Classroom.create({
      ...value,
      currentEnrollment: 0,
      status: 'active'
    });

    await this._emit('created', {
      classroomId: classroom._id,
      schoolId: value.schoolId,
      createdBy: __user.id,
      timestamp: new Date()
    });

    await this.cache.key.delete({key: `classrooms:list:${value.schoolId}:*`});

    return classroom;
  }

  // Get classroom details
  async get({__shark, __user, params}) {
    const classroomId = params.id;

    // if (__user.role !== 'superadmin' && __user.schoolId.toString() !== classroom.schoolId._id.toString()) {
    //   throw new Error('Access denied');
    // }
    
    const classroom = await this.Classroom.findById(classroomId)
      .populate('schoolId', 'name code')
      .populate('teacherId', 'profile.firstName profile.lastName email');

    if (!classroom) throw new Error('Classroom not found');


    return classroom;
  }

  // List classrooms with filters
  async list({__shark, __user, query}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };

    if (query.schoolId) {
      filter.schoolId = query.schoolId;
    } else if (__user.role !== 'superadmin') {
      filter.schoolId = __user.schoolId;
    }

    if (query.grade) filter.grade = parseInt(query.grade);
    if (query.status) filter.status = query.status;
    if (query.teacherId) filter.teacherId = query.teacherId;
    if (query.academicYear) filter.academicYear = query.academicYear;

    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { code: new RegExp(query.search, 'i') }
      ];
    }

    const cacheKey = `classrooms:list:${JSON.stringify(filter)}:${page}:${limit}`;
    const cached = await this.cache.key.get({key: cacheKey});
    if (cached) return JSON.parse(cached);

    const [classrooms, total] = await Promise.all([
      this.Classroom.find(filter)
        .populate('schoolId', 'name code')
        .populate('teacherId', 'profile.firstName profile.lastName')
        .skip(skip)
        .limit(limit)
        .sort({ grade: 1, section: 1 }),
      this.Classroom.countDocuments(filter)
    ]);

    const result = {
      data: classrooms,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    await this.cache.key.set({key: cacheKey, ttl: 120, data: JSON.stringify(result)});

    return result;
  }

  // Update classroom
  async update({__shark, __user, params, data: value}) {
    const classroomId = params.id;

    const { error } = ClassroomManager.validationSchemas.update.validate(value);
    if (error) throw new Error(`Validation error: ${error.message}`);

    const classroom = await this.Classroom.findById(classroomId);
    if (!classroom) throw new Error('Classroom not found');

    if ((__user.role !== 'superadmin' || __user.role !== 'school_admin') && __user.schoolId.toString() !== classroom.schoolId.toString()) {
      throw new Error('Access denied');
    }

    this.permissions.checkWithScope(__user, 'classrooms', 'update', classroom.schoolId)

    if (value.capacity && value.capacity < classroom.currentEnrollment) {
      throw new Error('Cannot reduce capacity below current enrollment');
    }

    Object.assign(classroom, value);
    classroom.updatedAt = new Date();
    await classroom.save();

    await this.cache.key.delete({ key: `classroom:${classroomId}`});
    await this.cache.key.delete({ key: `classrooms:list:${classroom.schoolId}:*`});

    await this._emit('updated', {
      classroomId: classroom._id,
      schoolId: classroom.schoolId,
      updatedBy: __user.id,
      changes: Object.keys(value),
      timestamp: new Date()
    });

    return classroom;
  }

  // Delete classroom
  async delete({__shark, __user, params}) {
    const classroomId = params.id;

    const classroom = await this.Classroom.findById(classroomId);
    if (!classroom) throw new Error('Classroom not found');

    if ((__user.role !== 'superadmin' || __user.role !== 'school_admin') && __user.schoolId.toString() !== classroom.schoolId.toString()) {
      throw new Error('Access denied');
    }

    this.permissions.checkWithScope(__user, 'classrooms', 'delete', classroom.schoolId)

    const studentCount = await this.Student.countDocuments({
      classroomId,
      'enrollment.status': 'enrolled'
    });

    if (studentCount > 0) {
      throw new Error('Cannot delete classroom with enrolled students');
    }

    classroom.deletedAt = new Date();
    await classroom.save();

    await this.cache.key.delete({key: `classroom:${classroomId}`});
    await this.cache.key.delete({key: `classrooms:list:${classroom.schoolId}:*`});

    await this._emit('deleted', {
      classroomId: classroom._id,
      schoolId: classroom.schoolId,
      deletedBy: __user.id,
      timestamp: new Date()
    });

    return { message: 'Classroom deleted successfully' };
  }

  // Assign teacher to classroom
  async assignTeacher({__shark, __user, params, data }) {
    const classroomId = params.id;
    const { teacherId } = data;

    const classroom = await this.Classroom.findById(classroomId);
    if (!classroom) throw new Error('Classroom not found');

    this.permissions.checkWithScope(__user, 'classrooms', 'update', classroom.schoolId)

    if ((__user.role !== 'superadmin' || __user.role !== 'school_admin') && __user.schoolId.toString() !== classroom.schoolId.toString()) {
      throw new Error('Access denied');
    }

    const teacher = await this.User.findOne({
      _id: teacherId,
      schoolId: classroom.schoolId,
      role: 'teacher',
      status: 'active'
    });

    if (!teacher) throw new Error('Teacher not found or not active');

    classroom.teacherId = teacherId;
    await classroom.save();

    await this.cache.key.delete({key: `classroom:${classroomId}`});

    await this._emit('teacherAssigned', {
      classroomId: classroom._id,
      teacherId,
      assignedBy: __user.id,
      timestamp: new Date()
    });

    return { message: 'Teacher assigned successfully', classroom };
  }

  // Get students in classroom
  async getStudents({__shark, __user, params, query}) {
    const classroomId = params.id;

    const classroom = await this.Classroom.findById(classroomId);
    if (!classroom) throw new Error('Classroom not found');

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== classroom.schoolId.toString()) {
      throw new Error('Access denied');
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      classroomId,
      'enrollment.status': 'enrolled'
    };

    const [students, total] = await Promise.all([
      this.Student.find(filter)
        .select('admissionNumber personalInfo contactInfo enrollment')
        .skip(skip)
        .limit(limit)
        .sort({ 'personalInfo.lastName': 1 }),
      this.Student.countDocuments(filter)
    ]);

    return {
      data: students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}