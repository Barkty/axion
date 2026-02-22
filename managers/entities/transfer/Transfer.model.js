const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    fromSchoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    toSchoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    fromClassroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom'
    },
    toClassroomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom'
    },
    transferDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    reason: {
        type: String,
        enum: ['relocation', 'school_change', 'graduation', 'other'],
        required: true
    },
    reasonDetails: String,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'completed', 'cancelled', 'rejected'],
        default: 'pending',
        index: true
    },
    documents: [{
        type: {
            type: String,
            enum: ['transfer_certificate', 'progress_report', 'other']
        },
        url: String,
        uploadedAt: Date
    }],
    notes: String,
    completedAt: Date,
    cancelledAt: Date,
    cancelledReason: String
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
transferSchema.index({ studentId: 1, createdAt: -1 });
transferSchema.index({ fromSchoolId: 1, toSchoolId: 1 });
transferSchema.index({ status: 1, transferDate: 1 });

// Virtual for duration
transferSchema.virtual('duration').get(function() {
    if (this.completedAt) {
        return this.completedAt - this.transferDate;
    }
    return null;
});

// Pre-save middleware
transferSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        if (this.status === 'completed') {
            this.completedAt = new Date();
        } else if (this.status === 'cancelled' && !this.cancelledAt) {
            this.cancelledAt = new Date();
        }
    }
    next();
});

transferSchema.statics.getTransferStats = async function(schoolId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                $or: [
                    { fromSchoolId: schoolId },
                    { toSchoolId: schoolId }
                ],
                transferDate: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                transfers: { $push: '$$ROOT' }
            }
        }
    ]);
};

module.exports = mongoose.model('Transfer', transferSchema);