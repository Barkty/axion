const ClassroomManager = require('../../managers/entities/classroom/Classroom.manager');
const { makeModel, makeCache, makeCortex, makeConfig, makeLogger, makeShark, makeUser } = require('../_mocks');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CLASSROOM_DATA = {
    schoolId:  'school-123',
    name:      'Class 5A',
    code:      '5A-2025',
    grade:     5,
    section:   'A',
    capacity:  30,
    academicYear: '2025-2026',
};

const CLASSROOM_RECORD = (overrides = {}) => ({
    _id:               'classroom-123',
    schoolId:          'school-123',
    name:              'Class 5A',
    code:              '5A-2025',
    grade:             5,
    capacity:          30,
    currentEnrollment: 0,
    status:            'active',
    save:              jest.fn().mockResolvedValue(true),
    ...overrides,
});

const SCHOOL_RECORD = {
    _id:      'school-123',
    settings: { maxClassrooms: 50 },
};

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeManager = (overrides = {}) => {
    const classroomModel = makeModel(overrides.Classroom || {});
    const schoolModel    = makeModel(overrides.School    || {});
    const studentModel   = makeModel(overrides.Student   || {});
    const userModel      = makeModel(overrides.User      || {});
    const cortex         = makeCortex();
    const cache          = makeCache();
    const shark          = makeShark();
    const logger         = makeLogger();
    const config         = makeConfig();

    const manager = new ClassroomManager({
        database:    {},
        mongomodels: { Classroom: classroomModel, School: schoolModel, Student: studentModel, User: userModel },
        cache,
        cortex,
        config,
        managers: { logger, shark },
    });

    return { manager, classroomModel, schoolModel, studentModel, userModel, cortex, cache, shark };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClassroomManager', () => {

    // ── create ──────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates a classroom with valid data', async () => {
            const { manager, classroomModel, schoolModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);
            classroomModel.findOne.mockResolvedValue(null);
            classroomModel.countDocuments.mockResolvedValue(5);
            classroomModel.create.mockResolvedValue({ _id: 'classroom-123', ...VALID_CLASSROOM_DATA });

            const result = await manager.create({ __user: makeUser(), data: VALID_CLASSROOM_DATA });

            expect(result._id).toBe('classroom-123');
            expect(classroomModel.create).toHaveBeenCalledWith(
                expect.objectContaining({ currentEnrollment: 0, status: 'active' })
            );
        });

        it('emits classroom.created event', async () => {
            const { manager, classroomModel, schoolModel, cortex } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);
            classroomModel.findOne.mockResolvedValue(null);
            classroomModel.countDocuments.mockResolvedValue(0);
            classroomModel.create.mockResolvedValue({ _id: 'classroom-123', ...VALID_CLASSROOM_DATA });

            await manager.create({ __user: makeUser(), data: VALID_CLASSROOM_DATA });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'classroom.created' })
            );
        });

        it('throws if school not found', async () => {
            const { manager, schoolModel } = makeManager();
            schoolModel.findById.mockResolvedValue(null);

            await expect(
                manager.create({ __user: makeUser(), data: VALID_CLASSROOM_DATA })
            ).rejects.toThrow('School not found');
        });

        it('throws if school has reached max classroom limit', async () => {
            const { manager, schoolModel, classroomModel } = makeManager();
            schoolModel.findById.mockResolvedValue({ ...SCHOOL_RECORD, settings: { maxClassrooms: 5 } });
            classroomModel.countDocuments.mockResolvedValue(5);

            await expect(
                manager.create({ __user: makeUser(), data: VALID_CLASSROOM_DATA })
            ).rejects.toThrow('School has reached maximum classroom limit');
        });

        it('throws if classroom code already exists in the school', async () => {
            const { manager, schoolModel, classroomModel } = makeManager();
            schoolModel.findById.mockResolvedValue(SCHOOL_RECORD);
            classroomModel.countDocuments.mockResolvedValue(0);
            classroomModel.findOne.mockResolvedValue({ _id: 'existing' });

            await expect(
                manager.create({ __user: makeUser(), data: VALID_CLASSROOM_DATA })
            ).rejects.toThrow('Classroom code already exists in this school');
        });

        it('throws validation error for invalid data', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({ __user: makeUser(), data: { name: 'Bad' } })
            ).rejects.toThrow('Validation error');
        });

        it('throws access denied for school_admin accessing another school', async () => {
            const { manager } = makeManager();

            await expect(
                manager.create({
                    __user: makeUser({ role: 'school_admin', schoolId: 'other-school' }),
                    data:   VALID_CLASSROOM_DATA,
                })
            ).rejects.toThrow('Access denied');
        });
    });

    // ── get ─────────────────────────────────────────────────────────────────

    describe('get', () => {
        it('returns classroom with populated fields', async () => {
            const populated = CLASSROOM_RECORD({ schoolId: { _id: 'school-123', name: 'Test' } });
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                then:     undefined,
                // Resolve the chain
                populate: jest.fn().mockResolvedValue(populated),
            });

            // Simpler: just mock findById to resolve directly
            classroomModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(populated),
                }),
            });

            const result = await manager.get({ __user: makeUser(), params: { id: 'classroom-123' } });

            expect(result._id).toBe('classroom-123');
        });

        it('throws if classroom not found', async () => {
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockResolvedValue(null),
                }),
            });

            await expect(
                manager.get({ __user: makeUser(), params: { id: 'ghost' } })
            ).rejects.toThrow('Classroom not found');
        });
    });

    // ── update ──────────────────────────────────────────────────────────────

    describe('update', () => {
        it('updates classroom fields', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);

            await manager.update({
                __user:  makeUser(),
                params:  { id: 'classroom-123' },
                data:    { name: 'Class 5B', capacity: 35 },
            });

            expect(classroom.name).toBe('Class 5B');
            expect(classroom.save).toHaveBeenCalled();
        });

        it('throws if new capacity is below current enrollment', async () => {
            const classroom = CLASSROOM_RECORD({ currentEnrollment: 25 });
            const { manager, classroomModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);

            await expect(
                manager.update({
                    __user:  makeUser(),
                    params:  { id: 'classroom-123' },
                    data:    { capacity: 20 },
                })
            ).rejects.toThrow('Cannot reduce capacity below current enrollment');
        });

        it('emits classroom.updated event', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, classroomModel, cortex } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);

            await manager.update({
                __user:  makeUser(),
                params:  { id: 'classroom-123' },
                data:    { name: 'Updated' },
            });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'classroom.updated' })
            );
        });
    });

    // ── delete ──────────────────────────────────────────────────────────────

    describe('delete', () => {
        it('soft-deletes a classroom with no enrolled students', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, classroomModel, studentModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.countDocuments.mockResolvedValue(0);

            const result = await manager.delete({ __user: makeUser(), params: { id: 'classroom-123' } });

            expect(result.message).toBe('Classroom deleted successfully');
            expect(classroom.deletedAt).toBeDefined();
        });

        it('blocks deletion if students are enrolled', async () => {
            const { manager, classroomModel, studentModel } = makeManager();
            classroomModel.findById.mockResolvedValue(CLASSROOM_RECORD());
            studentModel.countDocuments.mockResolvedValue(15);

            await expect(
                manager.delete({ __user: makeUser(), params: { id: 'classroom-123' } })
            ).rejects.toThrow('Cannot delete classroom with enrolled students');
        });

        it('emits classroom.deleted event', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, classroomModel, studentModel, cortex } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.countDocuments.mockResolvedValue(0);

            await manager.delete({ __user: makeUser(), params: { id: 'classroom-123' } });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'classroom.deleted' })
            );
        });
    });

    // ── assignTeacher ────────────────────────────────────────────────────────

    describe('assignTeacher', () => {
        it('assigns an active teacher to a classroom', async () => {
            const classroom = CLASSROOM_RECORD();
            const teacher   = { _id: 'teacher-123', role: 'teacher', status: 'active' };
            const { manager, classroomModel, userModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            userModel.findOne.mockResolvedValue(teacher);

            const result = await manager.assignTeacher({
                __user:  makeUser(),
                params:  { id: 'classroom-123' },
                data:    { teacherId: 'teacher-123' },
            });

            expect(result.message).toBe('Teacher assigned successfully');
            expect(classroom.teacherId).toBe('teacher-123');
            expect(classroom.save).toHaveBeenCalled();
        });

        it('throws if teacher not found or not active', async () => {
            const { manager, classroomModel, userModel } = makeManager();
            classroomModel.findById.mockResolvedValue(CLASSROOM_RECORD());
            userModel.findOne.mockResolvedValue(null);

            await expect(
                manager.assignTeacher({
                    __user:  makeUser(),
                    params:  { id: 'classroom-123' },
                    data:    { teacherId: 'ghost-teacher' },
                })
            ).rejects.toThrow('Teacher not found or not active');
        });

        it('emits classroom.teacherAssigned event', async () => {
            const classroom = CLASSROOM_RECORD();
            const teacher   = { _id: 'teacher-123', role: 'teacher', status: 'active' };
            const { manager, classroomModel, userModel, cortex } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            userModel.findOne.mockResolvedValue(teacher);

            await manager.assignTeacher({
                __user:  makeUser(),
                params:  { id: 'classroom-123' },
                data:    { teacherId: 'teacher-123' },
            });

            expect(cortex.AsyncEmitToOneOf).toHaveBeenCalledWith(
                expect.objectContaining({ call: 'classroom.teacherAssigned' })
            );
        });
    });

    // ── getStudents ──────────────────────────────────────────────────────────

    describe('getStudents', () => {
        it('returns paginated list of enrolled students', async () => {
            const classroom = CLASSROOM_RECORD();
            const { manager, classroomModel, studentModel } = makeManager();
            classroomModel.findById.mockResolvedValue(classroom);
            studentModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                skip:   jest.fn().mockReturnThis(),
                limit:  jest.fn().mockReturnThis(),
                sort:   jest.fn().mockResolvedValue([{ _id: 'student-1' }]),
            });
            studentModel.countDocuments.mockResolvedValue(1);

            const result = await manager.getStudents({
                __user:  makeUser(),
                params:  { id: 'classroom-123' },
                query:   { page: '1', limit: '10' },
            });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
        });
    });
});