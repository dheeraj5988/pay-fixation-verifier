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

const AccountOfficerSchema = new mongoose.Schema(
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
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },

    tokenBalance: { type: Number, default: 0, min: 0 },
    reportsProcessedCount: { type: Number, default: 0, min: 0 },

    role: { type: String, enum: ['ao'], default: 'ao' },
    otp: { type: OtpSubSchema, default: () => ({}) },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

AccountOfficerSchema.index({ loginId: 1 });
AccountOfficerSchema.index({ department: 1 });
AccountOfficerSchema.index({ phone: 1 });

export default mongoose.models.AccountOfficer || mongoose.model('AccountOfficer', AccountOfficerSchema);
