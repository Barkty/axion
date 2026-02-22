const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9-]+$/, 'School code must contain only uppercase letters, numbers, and hyphens']
    },
    address: {
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true,
            index: true
        },
        state: {
            type: String,
            required: true
        },
        zipCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true,
            default: 'USA'
        }
    },
    contact: {
        email: {
            type: String,
            required: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
        },
        phone: {
            type: String,
            required: true,
            match: [/^[0-9+\-\s()]+$/, 'Please fill a valid phone number']
        },
        website: {
            type: String,
            match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please fill a valid URL']
        }
    },
    settings: {
        maxClassrooms: {
            type: Number,
            default: 50,
            min: 1,
            max: 1000
        },
        maxStudentsPerClass: {
            type: Number,
            default: 30,
            min: 1,
            max: 100
        },
        academicYear: {
            type: String,
            default: () => {
                const year = new Date().getFullYear();
                return `${year}-${year + 1}`;
            },
            match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
        },
        gradingSystem: {
            type: String,
            enum: ['letter', 'percentage', 'gpa'],
            default: 'letter'
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});


// Indexes
schoolSchema.index({ name: 'text', code: 'text' });
schoolSchema.index({ 'address.city': 1, 'address.state': 1 });
schoolSchema.index({ status: 1, createdAt: -1 });

// Virtuals
schoolSchema.virtual('classrooms', {
    ref: 'Classroom',
    localField: '_id',
    foreignField: 'schoolId',
    options: { match: { status: 'active' } }
});

schoolSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'schoolId',
    options: { match: { 'enrollment.status': 'enrolled' } }
});

schoolSchema.virtual('staff', {
    ref: 'User',
    localField: '_id',
    foreignField: 'schoolId',
    options: { match: { status: 'active', role: { $in: ['school_admin', 'teacher'] } } }
});

// Pre-save middleware
schoolSchema.pre('save', function(next) {
    // Auto-generate code if not provided
    if (!this.code) {
        this.code = this.name
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

// Methods
schoolSchema.methods.getStats = async function() {
    const stats = await mongoose.model('School').aggregate([
        { $match: { _id: this._id } },
        {
            $lookup: {
                from: 'classrooms',
                localField: '_id',
                foreignField: 'schoolId',
                as: 'classroomStats'
            }
        },
        {
            $lookup: {
                from: 'students',
                localField: '_id',
                foreignField: 'schoolId',
                as: 'studentStats'
            }
        },
        {
            $project: {
                totalClassrooms: { $size: '$classroomStats' },
                activeClassrooms: {
                    $size: {
                        $filter: {
                            input: '$classroomStats',
                            as: 'c',
                            cond: { $eq: ['$$c.status', 'active'] }
                        }
                    }
                },
                totalStudents: { $size: '$studentStats' },
                enrolledStudents: {
                    $size: {
                        $filter: {
                            input: '$studentStats',
                            as: 's',
                            cond: { $eq: ['$$s.enrollment.status', 'enrolled'] }
                        }
                    }
                }
            }
        }
    ]);
    
    return stats[0] || {};
};

module.exports = mongoose.model('School', schoolSchema);