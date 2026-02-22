const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false
    },
    role: {
        type: String,
        enum: ['superadmin', 'school_admin', 'teacher', 'student'],
        required: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        default: null // null for superadmin
    },
    profile: {
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
        phone: {
            type: String,
            trim: true,
            match: [/^[0-9+\-\s()]+$/, 'Please fill a valid phone number']
        },
        avatar: {
            type: String,
            default: null
        }
    },
    permissions: [{
        type: String,
        enum: [
            'manage_schools',
            'manage_users',
            'manage_classrooms', 
            'manage_students',
            'manage_teachers',
            'view_reports',
            'system_config',
            'view_students',
            'manage_attendance',
            'manage_grades',
            'view_profile',
            'view_grades',
            'assign_role'
        ]
    }],
    lastLogin: {
        type: Date,
        default: null
    },
    passwordChangedAt: {
        type: Date,
        default: null
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
},
{
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ schoolId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'profile.firstName': 1, 'profile.lastName': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        this.passwordChangedAt = new Date();
        next();
    } catch (error) {
        next(error);
    }
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function() {
    // Reset attempts if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock the account if we've reached max attempts
    if (this.loginAttempts + 1 >= 5) {
        updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // Lock for 30 minutes
    }
    
    return this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema);