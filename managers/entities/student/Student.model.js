const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
    classroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
    },
    admissionNumber: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9-]+$/, 'Admission number must contain only uppercase letters, numbers, and hyphens']
    },
    personalInfo: {
        firstName: {
            type: String,
            required: true,
            trim: true
        },
        lastName: {
            type: String,
            required: true,
            trim: true
        },
        dateOfBirth: {
            type: Date,
            required: true
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
            required: true
        },
        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
            default: null
        },
        nationality: {
            type: String,
            default: 'USA'
        }
    },
    contactInfo: {
        address: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            match: [/^[0-9+\-\s()]+$/, 'Please fill a valid phone number']
        },
        email: {
            type: String,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
        },
        emergencyContact: {
            name: {
                type: String,
                required: true
            },
            relationship: {
                type: String,
                required: true
            },
            phone: {
                type: String,
                required: true,
                match: [/^[0-9+\-\s()]+$/, 'Please fill a valid phone number']
            }
        }
    },
    parentInfo: [{
        name: {
            type: String,
            required: true
        },
        relationship: {
            type: String,
            enum: ['father', 'mother', 'guardian', 'other'],
            required: true
        },
        phone: {
            type: String,
            match: [/^[0-9+\-\s()]+$/, 'Please fill a valid phone number']
        },
        email: {
            type: String,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
        },
        isPrimary: {
            type: Boolean,
            default: false
        },
        occupation: String,
        education: String
    }],
    enrollment: {
        date: {
            type: Date,
            required: true,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['enrolled', 'transferred', 'graduated', 'suspended', 'expelled'],
            default: 'enrolled',
        },
        previousSchool: String,
        previousClass: String,
        notes: String
    },
    academicInfo: {
        rollNumber: {
            type: String,
            trim: true
        },
        stream: {
            type: String,
            enum: ['science', 'commerce', 'arts', null],
            default: null
        },
        electives: [{
            type: String
        }],
        joinDate: {
            type: Date,
            default: Date.now
        }
    },
    documents: [{
        type: {
            type: String,
            enum: ['birth_certificate', 'transcripts', 'medical_records', 'id_proof', 'other']
        },
        title: String,
        url: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        verified: {
            type: Boolean,
            default: false
        }
    }],
    medicalInfo: {
        bloodGroup: String,
        allergies: [String],
        medications: [String],
        conditions: [String],
        doctorName: String,
        doctorPhone: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
studentSchema.index({ schoolId: 1 });
studentSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });
studentSchema.index({ classroomId: 1 });
studentSchema.index({ 'enrollment.status': 1 });
studentSchema.index({ createdAt: -1 });

// Text search index
studentSchema.index({
    'personalInfo.firstName': 'text',
    'personalInfo.lastName': 'text',
    admissionNumber: 'text'
});

// Virtual for full name
studentSchema.virtual('fullName').get(function() {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Pre-save middleware
studentSchema.pre('save', async function(next) {
    // Auto-generate roll number if not provided
    if (!this.academicInfo.rollNumber) {
        const year = new Date().getFullYear().toString().slice(-2);
        const count = await mongoose.model('Student').countDocuments({
            schoolId: this.schoolId,
            createdAt: {
                $gte: new Date(new Date().getFullYear(), 0, 1)
            }
        });
        this.academicInfo.rollNumber = `${year}${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

studentSchema.methods.transfer = async function(toSchoolId, toClassroomId, reason) {
    const Transfer = mongoose.model('Transfer');
    
    const transfer = await Transfer.create({
        studentId: this._id,
        fromSchoolId: this.schoolId,
        toSchoolId,
        fromClassroomId: this.classroomId,
        toClassroomId,
        reason,
        status: 'pending'
    });
    
    return transfer;
};

studentSchema.methods.getTransferHistory = async function() {
    return mongoose.model('Transfer')
        .find({ studentId: this._id })
        .populate('fromSchoolId', 'name code')
        .populate('toSchoolId', 'name code')
        .populate('fromClassroomId', 'name code')
        .populate('toClassroomId', 'name code')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Student', studentSchema);