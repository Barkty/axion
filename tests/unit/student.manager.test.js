const StudentManager = require('../../managers/entities/student/Student.manager');
const { makeModel, makeCache, makeCortex, makeConfig, makeLogger, makeShark, makeUser } = require('../_mocks');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_STUDENT_DATA = {
    schoolId:        'school-123',
    classroomId:     'classroom-123',
    admissionNumber: 'ADM-2025-001',
    personalInfo: {
        firstName:   'Amara',
        lastName:    'Okafor',
        dateOfBirth: '2010-03-15',
        gender:      'female',
        bloodGroup:  'O+',
        nationality: 'Nigerian',
    },
    contactInfo: {
        address: '12 Palm Avenue, Lagos',
        phone:   '+2348012345678',
        email:   'amara.okafor@student.edu',
        emergencyContact: {
            name:         'Chidi Okafor',
            relationship: 'Father',
            phone:        '+2348087654321',
        },
    },
    parentInfo: [{
        name:         'Chidi Okafor',
        relationship: 'Father',
        phone:        '+2348087654321',
        isPrimary:    true,
    }],
};

const STUDENT_RECORD = (overrides = {}) => ({
    _id:             'student-123',
    schoolId:        'school-123',
    classroomId:     'classroom-123',
    admissionNumber: 'ADM-2025-001',
    personalInfo:    { firstName: 'Amara', lastName: 'Okafor' },
    enrollment:      { status: 'enrolled', date: new Date() },
    parentInfo:      [],
    save:            jest.fn().mockResolvedValue(true),
    ...overrides,
});

const CLASSROOM_RECORD = (overrides = {}) => ({
    _id:               'classroom-123',
    schoolId:          'school-123',
    capacity:          30,
    currentEnrollment: 10,
    save:              jest.fn().mockResolvedValue(true),
    ...overrides,
});

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeManager = (overrides = {}) => {
    const studentModel   = makeModel(overrides.Student   || {});
    const classroomModel = makeModel(overrides.Classroom || {});
    const schoolModel    = makeModel(overrides.School    || {});
    const transferModel  = makeModel(overrides.Transfer  || {});
    const cortex         = makeCortex();
    const cache          = makeCache();
    const shark          = makeShark();
    const logger         = makeLogger();
    const config         = makeConfig();

    const manager = new StudentManager({
        database:    {},
        mongomodels: {
            Student:   studentModel,
            Classroom: classroomModel,
            School:    schoolModel,
            Transfer:  transferModel,
        },
        cache,
        cortex,
        config,
        managers: { logger, shark },
    });

    return { manager, studentModel, classroomModel, schoolModel, transferModel, cortex, cache, shark };
};

// Mock mongoose session
const mockSession = () => {
    const session = {
        startTransaction:  jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(true),
        abortTransaction:  jest.fn().mockResolvedValue(true),
        endSession:        jest.fn(),
    };
    return session;
};

jest.mock('mongoose', () => ({
    startSession: jest.fn().mockResolvedValue({
        startTransaction:  jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(true),
        abortTransaction:  jest.fn().mockResolvedValue(true),
        endSession:        jest.fn(),
    }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StudentManager', () => {

    // ── create ──────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates a student with valid data', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, studentModel, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.findOne.mockResolvedValue(null);
            studentModel.create.mockResolvedValue([STUDENT_RECORD()]);

            const result = await manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA });

            expect(result._id).toBe('student-123');
            expect(studentModel.create).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        enrollment: expect.objectContaining({ status: 'enrolled' }),
                    }),
                ]),
                expect.any(Object)
            );
        });

        it('increments classroom enrollment after creation', async () => {
            const classroom = CLASSROOM_RECORD({ currentEnrollment: 10 });
            const { manager, studentModel, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.findOne.mockResolvedValue(null);
            studentModel.create.mockResolvedValue([STUDENT_RECORD()]);

            await manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA });

            expect(classroom.currentEnrollment).toBe(11);
            expect(classroom.save).toHaveBeenCalled();
        });

        it('emits student.created event', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, studentModel, classroomModel, cortex } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.findOne.mockResolvedValue(null);
            studentModel.create.mockResolvedValue([STUDENT_RECORD()]);

            await manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'student.created' })
            );
        });

        it('throws if classroom not found', async () => {
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(null);

            await expect(
                manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA })
            ).rejects.toThrow('Classroom not found');
        });

        it('throws if classroom is at full capacity', async () => {
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(
                CLASSROOM_RECORD({ capacity: 30, currentEnrollment: 30 })
            );

            await expect(
                manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA })
            ).rejects.toThrow('Classroom has reached maximum capacity');
        });

        it('throws if classroom does not belong to specified school', async () => {
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(
                CLASSROOM_RECORD({ schoolId: 'different-school' })
            );

            await expect(
                manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA })
            ).rejects.toThrow('Classroom does not belong to specified school');
        });

        it('throws if admission number already exists', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, studentModel, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.findOne.mockResolvedValue({ _id: 'existing-student' });

            await expect(
                manager.create({ __user: makeUser(), data: VALID_STUDENT_DATA })
            ).rejects.toThrow('Admission number already exists');
        });

        it('throws validation error for missing required fields', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({ __user: makeUser(), data: { schoolId: 'school-123' } })
            ).rejects.toThrow('Validation error');
        });

        it('throws access denied for school_admin from different school', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({
                    __user: makeUser({ role: 'school_admin', schoolId: 'other-school' }),
                    data:   VALID_STUDENT_DATA,
                })
            ).rejects.toThrow('Access denied');
        });
    });

    // ── getStudent ───────────────────────────────────────────────────────────

    describe('getStudent', () => {
        it('returns student for valid ID', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel, cache } = makeManager();
            cache.get.mockResolvedValue(null);
            studentModel.findById.mockResolvedValue(student);

            const result = await manager.getStudent({ __user: makeUser(), params: { id: 'student-123' } });

            expect(result._id).toBe('student-123');
        });

        it('returns cached student without hitting database', async () => {
            const cached = STUDENT_RECORD();
            const { manager, studentModel, cache } = makeManager();
            cache.get.mockResolvedValue(JSON.stringify(cached));

            const result = await manager.getStudent({ __user: makeUser(), params: { id: 'student-123' } });

            expect(result._id).toBe('student-123');
            expect(studentModel.findById).not.toHaveBeenCalled();
        });

        it('throws if student not found', async () => {
            const { manager, cache } = makeManager();
            cache.get.mockResolvedValue(null);

            await expect(
                manager.getStudent({ __user: makeUser(), params: { id: 'ghost' } })
            ).rejects.toThrow('Student not found');
        });

        it('throws access denied for different school', async () => {
            const student = STUDENT_RECORD({ schoolId: 'other-school' });
            const { manager, studentModel, cache } = makeManager();
            cache.get.mockResolvedValue(null);
            studentModel.findById.mockResolvedValue(student);

            await expect(
                manager.getStudent({
                    __user:  makeUser({ role: 'school_admin', schoolId: 'school-123' }),
                    params:  { id: 'student-123' },
                })
            ).rejects.toThrow('Access denied');
        });
    });

    // ── updateStudent ────────────────────────────────────────────────────────

    describe('updateStudent', () => {
        it('updates student fields', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel } = makeManager();
            studentModel.findById.mockResolvedValue(student);

            await manager.updateStudent({
                __user:  makeUser(),
                params:  { id: 'student-123' },
                data:    { personalInfo: { firstName: 'Updated', lastName: 'Name' } },
            });

            expect(student.personalInfo.firstName).toBe('Updated');
            expect(student.save).toHaveBeenCalled();
        });

        it('emits student.updated event', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel, cortex } = makeManager();
            studentModel.findById.mockResolvedValue(student);

            await manager.updateStudent({
                __user:  makeUser(),
                params:  { id: 'student-123' },
                data:    { personalInfo: { firstName: 'Updated', lastName: 'Name' } },
            });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'student.updated' })
            );
        });

        it('throws if student not found', async () => {
            const { manager } = makeManager();

            await expect(
                manager.updateStudent({
                    __user:  makeUser(),
                    params:  { id: 'ghost' },
                    data:    { personalInfo: { firstName: 'Xar', lastName: 'Yen' } },
                })
            ).rejects.toThrow('Student not found');
        });

        it('clears student cache after update', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel, cache } = makeManager();
            studentModel.findById.mockResolvedValue(student);

            await manager.updateStudent({
                __user:  makeUser(),
                params:  { id: 'student-123' },
                data:    { personalInfo: { firstName: 'Updated', lastName: 'Name' } },
            });

            expect(cache.del).toHaveBeenCalledWith('student:student-123');
        });
    });

    // ── deleteStudent ────────────────────────────────────────────────────────

    describe('deleteStudent', () => {
        it('soft-deletes a student', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel } = makeManager();
            studentModel.findById.mockResolvedValue(student);

            const result = await manager.deleteStudent({ __user: makeUser(), params: { id: 'student-123' } });

            expect(result.message).toBe('Student deleted successfully');
            expect(student.deletedAt).toBeDefined();
            expect(student.status).toBe('inactive');
        });

        it('emits student.deleted event', async () => {
            const student = STUDENT_RECORD();
            const { manager, studentModel, cortex } = makeManager();
            studentModel.findById.mockResolvedValue(student);

            await manager.deleteStudent({ __user: makeUser(), params: { id: 'student-123' } });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'student.deleted' })
            );
        });

        it('throws if student not found', async () => {
            const { manager } = makeManager();

            await expect(
                manager.deleteStudent({ __user: makeUser(), params: { id: 'ghost' } })
            ).rejects.toThrow('Student not found');
        });
    });

    // ── list ─────────────────────────────────────────────────────────

    describe('list', () => {
        it('returns paginated list', async () => {
            const { manager, studentModel } = makeManager();
            studentModel.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                skip:     jest.fn().mockReturnThis(),
                limit:    jest.fn().mockReturnThis(),
                sort:     jest.fn().mockResolvedValue([STUDENT_RECORD()]),
            });
            studentModel.countDocuments.mockResolvedValue(1);

            const result = await manager.list({
                __user: makeUser(),
                query:  { page: '1', limit: '10' },
            });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });

        it('returns cached list without hitting database', async () => {
            const cached = { data: [STUDENT_RECORD()], pagination: { total: 1 } };
            const { manager, studentModel, cache } = makeManager();
            cache.get.mockResolvedValue(JSON.stringify(cached));

            await manager.list({ __user: makeUser(), query: {} });

            expect(studentModel.find).not.toHaveBeenCalled();
        });

        it('filters by school for non-superadmin', async () => {
            const { manager, studentModel } = makeManager();
            studentModel.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                skip:     jest.fn().mockReturnThis(),
                limit:    jest.fn().mockReturnThis(),
                sort:     jest.fn().mockResolvedValue([]),
            });
            studentModel.countDocuments.mockResolvedValue(0);

            await manager.list({
                __user: makeUser({ role: 'school_admin', schoolId: 'school-123' }),
                query:  {},
            });

            const filterArg = studentModel.find.mock.calls[0][0];
            expect(filterArg.schoolId).toBe('school-123');
        });
    });

    // ── transfer ─────────────────────────────────────────────────────────────

    describe('transfer', () => {
        it('transfers student to a new classroom', async () => {
            const student        = STUDENT_RECORD();
            const targetClassroom = CLASSROOM_RECORD({ _id: 'classroom-456', schoolId: 'school-456' });
            const { manager, studentModel, classroomModel, transferModel } = makeManager();
            studentModel.findById.mockResolvedValue(student);
            classroomModel.findById.mockResolvedValue(targetClassroom);
            classroomModel.findByIdAndUpdate.mockResolvedValue({});
            transferModel.create.mockResolvedValue([{ _id: 'transfer-123' }]);

            const result = await manager.transfer({
                __user:  makeUser(),
                params:  { id: 'student-123' },
                data:    { toSchoolId: 'school-456', toClassroomId: 'classroom-456', reason: 'Relocation' },
            });

            expect(result.message).toBe('Student transferred successfully');
        });

        it('throws if target classroom at capacity', async () => {
            const student         = STUDENT_RECORD();
            const fullClassroom   = CLASSROOM_RECORD({ capacity: 30, currentEnrollment: 30, schoolId: 'school-456' });
            const { manager, studentModel, classroomModel } = makeManager();
            studentModel.findById.mockResolvedValue(student);
            classroomModel.findById.mockResolvedValue(fullClassroom);

            await expect(
                manager.transfer({
                    __user:  makeUser(),
                    params:  { id: 'student-123' },
                    data:    { toSchoolId: 'school-456', toClassroomId: 'classroom-456', reason: 'Test' },
                })
            ).rejects.toThrow('Target classroom has reached maximum capacity');
        });

        it('emits student.transferred event', async () => {
            const student         = STUDENT_RECORD();
            const targetClassroom = CLASSROOM_RECORD({ _id: 'classroom-456', schoolId: 'school-456' });
            const { manager, studentModel, classroomModel, transferModel, cortex } = makeManager();
            studentModel.findById.mockResolvedValue(student);
            classroomModel.findById.mockResolvedValue(targetClassroom);
            classroomModel.findByIdAndUpdate.mockResolvedValue({});
            transferModel.create.mockResolvedValue([{ _id: 'transfer-123' }]);

            await manager.transfer({
                __user:  makeUser(),
                params:  { id: 'student-123' },
                data:    { toSchoolId: 'school-456', toClassroomId: 'classroom-456', reason: 'Relocation' },
            });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'student.transferred' })
            );
        });
    });
});