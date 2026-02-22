/**
 * Shared mock factory — keeps all test setups DRY and consistent
 * with the actual injectable shape the constructors expect.
 */

const makeModel = (overrides = {}) => ({
    findOne:         jest.fn().mockResolvedValue(null),
    findById:        jest.fn().mockResolvedValue(null),
    findByIdAndUpdate: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue(null),
    find:            jest.fn().mockReturnValue({
        populate:    jest.fn().mockReturnThis(),
        select:      jest.fn().mockReturnThis(),
        skip:        jest.fn().mockReturnThis(),
        limit:       jest.fn().mockReturnThis(),
        sort:        jest.fn().mockResolvedValue([]),
    }),
    create:          jest.fn().mockResolvedValue(null),
    countDocuments:  jest.fn().mockResolvedValue(0),
    aggregate:       jest.fn().mockResolvedValue([{}]),
    ...overrides,
});

const makeCache = () => ({
    get:    jest.fn().mockResolvedValue(null),
    setex:  jest.fn().mockResolvedValue('OK'),
    del:    jest.fn().mockResolvedValue(1),
});

const makeCortex = () => ({
    AsyncEmitToOneOf: jest.fn().mockResolvedValue({}),
    sub: jest.fn().mockResolvedValue({}),
});

const makeConfig = () => ({
    dotEnv: {
        CORTEX_TYPE: 'school-management',
        JWT_SECRET:  'test-secret',
    },
});

const makeLogger = () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const makeShark = () => ({
    isGranted:    jest.fn().mockResolvedValue(true),
});

const makeUser = (overrides = {}) => ({
    id:       'user-123',
    role:     'superadmin',
    schoolId: 'school-123',
    ...overrides,
});

let _counter = 0;
const uid = () => `${Date.now()}-${++_counter}`;

const userData = (overrides = {}) => ({
    email:           `user-${uid()}@test.com`,
    password:        'Test@1234',
    confirmPassword: 'Test@1234',
    profile:         { firstName: 'Test', lastName: 'User', phone: '+2348012345678' },
    role:            'superadmin',
    ...overrides,
});

const schoolData = (overrides = {}) => ({
    name: `School-${uid()}`,
    code: `SCH-${uid()}`,
    address: {
        street:  '10 Education Road',
        city:    'Lagos',
        state:   'Lagos',
        zipCode: '100001',
        country: 'Nigeria',
    },
    contact: {
        email:   'info@school.edu',
        phone:   '+2348012345678',
        website: 'https://school.edu',
    },
    settings: {
        maxClassrooms:       20,
        maxStudentsPerClass: 40,
        academicYear:        '2025-2026',
    },
    ...overrides,
});

const classroomData = (schoolId, overrides = {}) => ({
    schoolId,
    name:         `Class-${uid()}`,
    code:         `CLS-${uid()}`,
    grade:        5,
    section:      'A',
    capacity:     30,
    academicYear: '2025-2026',
    ...overrides,
});

const studentData = (schoolId, classroomId, overrides = {}) => ({
    schoolId,
    classroomId,
    admissionNumber: `ADM-${uid()}`,
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
        email:   'amara@student.edu',
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
    ...overrides,
});


module.exports = {
    makeModel,
    makeCache,
    makeCortex,
    makeConfig,
    makeLogger,
    makeShark,
    makeUser,
    userData,
    schoolData,
    studentData,
    classroomData
};