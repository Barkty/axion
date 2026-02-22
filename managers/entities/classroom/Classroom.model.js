const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9-]+$/, 'Classroom code must contain only uppercase letters, numbers, and hyphens']
    },
    grade: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
    },
    section: {
        type: String,
        uppercase: true,
        trim: true,
        maxlength: 5
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    currentEnrollment: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: function(v) {
                return v <= this.capacity;
            },
            message: 'Current enrollment cannot exceed capacity'
        }
    },
    resources: [{
        type: {
            type: String,
            enum: ['projector', 'whiteboard', 'ac', 'computers', 'lab_equipment', 'smart_board'],
            required: true
        },
        quantity: {
            type: Number,
            min: 1,
            default: 1
        },
        condition: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor'],
            default: 'good'
        }
    }],
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    academicYear: {
        type: String,
        required: true,
        match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active',
    },
    schedule: [{
        day: {
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        },
        startTime: String,
        endTime: String,
        subject: String
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for common queries
classroomSchema.index({ schoolId: 1 });
classroomSchema.index({ schoolId: 1, code: 1 }, { unique: true });
classroomSchema.index({ schoolId: 1, grade: 1, section: 1 });
classroomSchema.index({ teacherId: 1 });
classroomSchema.index({ status: 1 });
classroomSchema.index({ grade: 1 });


classroomSchema.pre('save', function(next) {
    // Ensure current enrollment doesn't exceed capacity
    if (this.currentEnrollment > this.capacity) {
        next(new Error('Current enrollment cannot exceed classroom capacity'));
    }
    next();
});

classroomSchema.virtual('availableSeats').get(function() {
    return this.capacity - this.currentEnrollment;
});


classroomSchema.virtual('utilization').get(function() {
    return (this.currentEnrollment / this.capacity) * 100;
});

classroomSchema.methods.isFull = function() {
    return this.currentEnrollment >= this.capacity;
};

classroomSchema.methods.enrollStudent = async function() {
    if (this.isFull()) {
        throw new Error('Classroom is at full capacity');
    }
    
    this.currentEnrollment += 1;
    return this.save();
};

classroomSchema.methods.removeStudent = async function() {
    if (this.currentEnrollment > 0) {
        this.currentEnrollment -= 1;
        return this.save();
    }
    return this;
};

module.exports = mongoose.model('Classroom', classroomSchema);