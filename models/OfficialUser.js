import mongoose from 'mongoose';

const OtpSubSchema = new mongoose.Schema(
  {
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0, max: 5 },
    lastSentAt: { type: Date },
  },
  { _id: false }
);

const OfficialUserSchema = new mongoose.Schema(
  {
    loginId: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 50 },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^(\+?91)?[6-9][0-9]{9}$/, 'Invalid Indian mobile number (10 digits starting 6-9, optional +91/91 prefix)'],
    },
    email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email format'] },

    role: { type: String, enum: ['super_admin', 'higher_official'], required: true },
    scope: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficialUser', default: null },

    otp: { type: OtpSubSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Mongoose 9: pre hooks throw synchronously instead of calling next().
OfficialUserSchema.pre('validate', function () {
  if (this.role === 'higher_official' && !this.invitedBy) {
    throw new Error('higher_official accounts must have invitedBy set');
  }
});

OfficialUserSchema.index({ loginId: 1 });
OfficialUserSchema.index({ role: 1 });
OfficialUserSchema.index({ phone: 1 });

export default mongoose.models.OfficialUser || mongoose.model('OfficialUser', OfficialUserSchema);
