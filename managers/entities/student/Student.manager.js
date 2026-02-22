const Joi = require('joi');
const { startSession } = require('mongoose')

module.exports = class StudentManager {
  static httpExposed = [
    'create=post',
    'getStudent=get',
    'list=get',
    'updateStudent=put',
    'deleteStudent=delete',
    'transfer=post',
    'getHistory=get'
  ];

  static NAME_REGEX = /^[A-Za-z]+([ '-][A-Za-z]+)*$/;
  static REPEATED_CHAR_REGEX = /(.)\1{3,}/;
  static BLOOD_GROUP = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  static nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(this.NAME_REGEX)
  .custom((value, helpers) => {
    if (this.REPEATED_CHAR_REGEX.test(value)) {
      return helpers.error('string.repeated');
    }
    return value;
  })
  .messages({
    'string.base': '{{#label}} must be a string',
    'string.empty': '{{#label}} is required',
    'string.min': '{{#label}} must be at least {#limit} characters',
    'string.max': '{{#label}} must not exceed {#limit} characters',
    'string.pattern.base': '{{#label}} contains invalid characters',
    'string.repeated': '{{#label}} contains unrealistic repeated characters',
  });

  static phoneNumberSchema = Joi.string()
  .trim()
  .custom((value, helpers) => {
    const normalized = value.replace(/[\s\-()]/g, '');

    if (!/^\+?\d+$/.test(normalized)) {
      return helpers.error('string.invalidPhone');
    }

    const digitsOnly = normalized.replace(/^\+/, '');

    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return helpers.error('string.phoneLength');
    }

    if (this.REPEATED_CHAR_REGEX.test(digitsOnly)) {
      return helpers.error('string.phoneRepeated');
    }

    return value;
  })
  .messages({
    'string.base': '{{#label}} must be a string',
    'string.empty': '{{#label}} is required',
    'string.invalidPhone': '{{#label}} must contain digits only',
    'string.phoneLength': '{{#label}} must be between 7 and 15 digits',
    'string.phoneRepeated': '{{#label}} contains unrealistic repeated digits',
  });

  static validationSchemas = {
    create: Joi.object({
      schoolId: Joi.string().required(),
      classroomId: Joi.string().required(),
      admissionNumber: Joi.string().required().pattern(/^[A-Z0-9-]+$/),
      personalInfo: Joi.object({
        firstName: this.nameSchema.required(),
        lastName: this.nameSchema.required(),
        dateOfBirth: Joi.date().required().max('now'),
        gender: Joi.string().required().valid('male', 'female', 'other'),
        bloodGroup: Joi.string().valid(...this.BLOOD_GROUP),
        nationality: Joi.string()
      }),
      contactInfo: Joi.object({
        address: Joi.string().required(),
        phone: this.phoneNumberSchema.label('Phone').required(),
        email: Joi.string().email(),
        emergencyContact: Joi.object({
          name: this.nameSchema.required(),
          relationship: Joi.string().required(),
          phone: this.phoneNumberSchema.label('Phone').required()
        })
      }),
      parentInfo: Joi.array().items(
        Joi.object({
          name: this.nameSchema.required(),
          relationship: Joi.string().required(),
          phone: this.phoneNumberSchema.label('Phone').required(),
          email: Joi.string().email(),
          isPrimary: Joi.boolean()
        })
      ).min(1),
      academicInfo: Joi.object({
        rollNumber: Joi.string(),
        stream: Joi.string().valid('science', 'commerce', 'arts'),
        electives: Joi.array().items(Joi.string())
      })
    }),
    update: Joi.object({
      classroomId: Joi.string(),
      personalInfo: Joi.object({
        firstName: this.nameSchema.required(),
        lastName: this.nameSchema.required(),
        bloodGroup: Joi.string().valid(...this.BLOOD_GROUP),
        nationality: Joi.string()
      }),
      contactInfo: Joi.object({
        address: Joi.string(),
        phone: this.phoneNumberSchema.label('Phone').required(),
        email: Joi.string().email(),
        emergencyContact: Joi.object({
          name: this.nameSchema,
          relationship: Joi.string(),
          phone: this.phoneNumberSchema.label('Phone').required()
        })
      }),
      parentInfo: Joi.array().items(
        Joi.object({
          name: this.nameSchema,
          relationship: Joi.string(),
          phone: this.phoneNumberSchema.label('Phone').required(),
          email: Joi.string().email(),
          isPrimary: Joi.boolean()
        })
      ),
      academicInfo: Joi.object({
        rollNumber: Joi.string(),
        stream: Joi.string().valid('science', 'commerce', 'arts'),
        electives: Joi.array().items(Joi.string())
      }),
      enrollment: Joi.object({
        status: Joi.string().valid('enrolled', 'transferred', 'graduated', 'suspended')
      })
    })
  };

  constructor(injectable) {
    this.database = injectable.database;
    this.models = injectable.mongomodels;
    this.Classroom = this.models.Classroom;
    this.School = this.models.School;
    this.Student = this.models.Student;
    this.Transfer = this.models.Transfer;
    this.cache = injectable.cache;
    this.cortex = injectable.cortex;
    this.config = injectable.config;
    this.logger = injectable.managers.logger;
    this.permissions = injectable.managers.permissions;

    this.httpExposed = StudentManager.httpExposed;


    this.eventHandlers = {
      created: async ({ studentId, schoolId, classroomId, createdBy, timestamp }) => {
        this.logger.info(`[student.created] studentId=${studentId} school=${schoolId} classroom=${classroomId} by=${createdBy} at ${timestamp}`);
        // e.g. send welcome notification, trigger onboarding workflow
      },

      updated: async ({ studentId, updatedBy, changes, timestamp }) => {
        this.logger.info(`[student.updated] studentId=${studentId} by=${updatedBy} changes=${changes} at ${timestamp}`);
        // e.g. audit log, sync to external systems
      },

      deleted: async ({ studentId, deletedBy, timestamp }) => {
        this.logger.info(`[student.deleted] studentId=${studentId} by=${deletedBy} at ${timestamp}`);
        // e.g. cascade cleanup, revoke access
      },

      transferred: async ({ studentId, fromSchool, toSchool, fromClassroom, toClassroom, transferredBy, reason, timestamp }) => {
        this.logger.info(`[student.transferred] studentId=${studentId} from=${fromSchool} to=${toSchool} by=${transferredBy} reason=${reason} at ${timestamp}`);
        // e.g. notify both schools, update external records
      }
    };
  }

  async _emit(fnName, args) {
    try {
      await this.cortex.AsyncEmitToOneOf({
        type: this.config.dotEnv.CORTEX_TYPE,
        call: `student.${fnName}`,
        args
      });
    } catch (err) {
      this.logger.error(`[cortex._emit] Failed to emit student.${fnName}:`, err.message);
    }
  }

  // Create student
  async create({__shark, __user, data: value }) {
    const { error } = StudentManager.validationSchemas.create.validate(value);
    if (error) throw new Error(`Validation error: ${error.message}`);

    his.permissions.checkWithScope(__user, 'students', 'create', value.schoolId)

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== value.schoolId) {
      throw new Error('Access denied');
    }

    const classroom = await this.Classroom.findById(value.classroomId);
    if (!classroom) throw new Error('Classroom not found');
    
    if (classroom.schoolId.toString() !== value.schoolId) {
      throw new Error('Classroom does not belong to specified school');
    }

    if (classroom.currentEnrollment >= classroom.capacity) {
      throw new Error('Classroom has reached maximum capacity');
    }

    const existingStudent = await this.Student.findOne({
      schoolId: value.schoolId,
      admissionNumber: value.admissionNumber
    });
    if (existingStudent) throw new Error('Admission number already exists');

    const session = await startSession();
    session.startTransaction();

    try {
      const student = await this.Student.create([{
        ...value,
        enrollment: {
          date: new Date(),
          status: 'enrolled'
        }
      }], { session });

      classroom.currentEnrollment += 1;
      await classroom.save({ session });

      await session.commitTransaction();

      await this._emit('created', {
        studentId: student[0]._id,
        schoolId: value.schoolId,
        classroomId: value.classroomId,
        createdBy: __user.id,
        timestamp: new Date()
      });

      await this.cache.key.delete({key: `students:list:${value.schoolId}:*`});
      await this.cache.key.delete({key: `classroom:${value.classroomId}`});

      return student[0];
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // Transfer student between schools/classrooms
  async transfer({__shark, __user, params, data }) {
    const studentId = params.id;
    const { toSchoolId, toClassroomId, reason } = data;

    const student = await this.Student.findById(studentId);
    if (!student) throw new Error('Student not found');

    this.permissions.check(__user, 'students', 'transfer')

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== student.schoolId.toString()) {
      throw new Error('Access denied');
    }

    const targetClassroom = await this.Classroom.findById(toClassroomId);
    if (!targetClassroom) throw new Error('Target classroom not found');

    if (targetClassroom.schoolId.toString() !== toSchoolId) {
      throw new Error('Classroom does not belong to target school');
    }

    if (targetClassroom.currentEnrollment >= targetClassroom.capacity) {
      throw new Error('Target classroom has reached maximum capacity');
    }

    const session = await startSession();
    session.startTransaction();

    try {
      const transfer = await this.Transfer.create([{
        studentId,
        fromSchoolId: student.schoolId,
        toSchoolId,
        fromClassroomId: student.classroomId,
        toClassroomId,
        transferDate: new Date(),
        reason,
        approvedBy: __user.id,
        status: 'completed'
      }], { session });

      if (student.classroomId) {
        await this.Classroom.findByIdAndUpdate(
          student.classroomId,
          { $inc: { currentEnrollment: -1 } },
          { session }
        );
      }

      targetClassroom.currentEnrollment += 1;
      await targetClassroom.save({ session });

      const fromSchoolId = student.schoolId.toString();
      const fromClassroomId = student.classroomId?.toString();

      student.schoolId = toSchoolId;
      student.classroomId = toClassroomId;
      student.enrollment.status = 'enrolled';
      student.enrollment.previousSchool = fromSchoolId;
      student.enrollment.notes = `Transferred from ${fromSchoolId} to ${toSchoolId}`;
      await student.save({ session });

      await session.commitTransaction();

      await this._emit('transferred', {
        studentId,
        fromSchool: fromSchoolId,
        toSchool: toSchoolId,
        fromClassroom: fromClassroomId,
        toClassroom: toClassroomId,
        transferredBy: __user.id,
        reason,
        timestamp: new Date()
      });

      await this.cache.key.delete({key: `student:${studentId}`});
      await this.cache.key.delete({key: `students:list:${fromSchoolId}:*`});
      await this.cache.key.delete({key: `students:list:${toSchoolId}:*`});

      return {
        message: 'Student transferred successfully',
        transfer: transfer[0]
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // Get student transfer history
  async getHistory({__shark, __user, params}) {
    const studentId = params.id;

    const student = await this.Student.findById(studentId);
    if (!student) throw new Error('Student not found');

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== student.schoolId.toString()) {
      throw new Error('Access denied');
    }

    const transfers = await this.Transfer.find({ studentId })
      .populate([
        { path: 'fromSchoolId', select: 'name code' }, 
        { path: 'toSchoolId', select: 'name code' }, 
        { path: 'fromClassroomId', select: 'name code' }, 
        { path: 'toClassroomId', select: 'name code' }, 
        { path: 'approvedBy', select: 'profile.firstName profile.lastName' }
      ]).sort({ transferDate: -1 });

    return transfers;
  }

  /**
   * List Students
   */
  async list({__shark, __user, query}) {
    try {
      this.permissions.checkWithScope(__user, 'students', 'list', query.schoolId)

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const skip = (page - 1) * limit;

      const filter = { deletedAt: null };
      
      if (__user.role !== 'superadmin') {
        filter.schoolId = __user.schoolId;
      }

      if (query.status) filter.status = query.status;
      if (query.schoolId && __user.role === 'superadmin') {
        filter.schoolId = query.schoolId;
      }

      if (query.search) {
        filter.$or = [
          { 'personalInfo.firstName': new RegExp(query.search, 'i') },
          { 'personalInfo.lastName': new RegExp(query.search, 'i') }
        ];
      }

      const cacheKey = `students:list:${JSON.stringify(filter)}:${page}:${limit}`;
      const cached = await this.cache.key.get({key: cacheKey});
      if (cached) return JSON.parse(cached);

      const [students, total] = await Promise.all([
        this.Student.find(filter)
          .populate('schoolId', 'name code')
          .populate('classroomId', 'name code grade')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        this.Student.countDocuments(filter)
      ]);

      const result = {
        data: students,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

      await this.cache.key.set({key: cacheKey, ttl: 120, data: JSON.stringify(result)});

      return result;

    } catch (error) {
      throw error;
    }
  }
  
  async getStudent({__shark, __user, params}) {
    const studentId = params.id;

    const cacheKey = `student:${studentId}`;
    const cached = await this.cache.key.get({key: cacheKey});
    if (cached) return JSON.parse(cached);

    const student = await this.Student.findById(studentId);
    if (!student) throw new Error('Student not found');

    this.permissions.checkWithScope(__user, 'students', 'view', student.schoolId.toString())

    if (__user.role !== 'superadmin' && __user.schoolId.toString() !== student.schoolId.toString()) {
      throw new Error('Access denied');
    }

    await this.cache.key.set({key: cacheKey, ttl: 300, data: JSON.stringify(student)});

    return student;
  }

  /**
   * Update Student (Admin only)
   */
  async updateStudent({__shark, __user, params, data: value }) {
    try {
      const studentId = params.id;

      const { error } = StudentManager.validationSchemas.update.validate(value);
      if (error) {
        throw new Error(`Validation error: ${error.message}`);
      }
      
      const student = await this.Student.findById(studentId);
      
      if (!student) {
        throw new Error('Student not found');
      }

      this.permissions.checkWithScope(__user, 'students', 'update', student.schoolId)

      if (__user.role === 'student' || student.schoolId?.toString() !== __user.schoolId?.toString()) {
        throw new Error('Access denied');
      }

      if (value.classroomId) student.classroomId = value.classroomId;
      if (value.personalInfo) student.personalInfo = { ...student.personalInfo, ...value.personalInfo };
      if (value.contactInfo) student.contactInfo = { ...student.contactInfo, ...value.contactInfo };
      if (value.academicInfo) student.academicInfo = { ...student.academicInfo, ...value.academicInfo };
      if (value.enrollment) student.enrollment = value.enrollment;
      if (value.parentInfo) student.parentInfo = [ ...student.parentInfo, ...value.parentInfo ];

      await student.save();

      await this.cache.key.delete({key: `student:${studentId}`});
      await this.cache.key.delete({key: 'students:list:*'});

      await this._emit('updated', {
        studentId: student._id,
        updatedBy: __user.id,
        changes: Object.keys(value),
        timestamp: new Date()
      });

      return student;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete Student (Soft delete - Admin only)
   */
  async deleteStudent({__shark, __user, params}) {
    try {
      const studentId = params.id;

      this.permissions.check(__user, 'students', 'delete')

      const student = await this.Student.findById(studentId);
      
      if (!student) {
        throw new Error('Student not found');
      }

      if ((__user.role !== 'superadmin' && __user.role !== 'school_admin') && 
          student.schoolId?.toString() !== __user.schoolId?.toString()) {
        throw new Error('Access denied');
      }

      student.deletedAt = new Date();
      student.status = 'inactive';
      await student.save();

      await this.cache.key.delete({key: `student:${studentId}`});
      await this.cache.key.delete({ key: 'students:list:*'});

      await this._emit('deleted', {
        studentId: student._id,
        deletedBy: __user.id,
        timestamp: new Date()
      });

      return { message: 'Student deleted successfully' };

    } catch (error) {
      throw error;
    }
  }
}