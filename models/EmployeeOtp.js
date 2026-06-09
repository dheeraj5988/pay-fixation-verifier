import mongoose from 'mongoose';

// One active OTP challenge per submission for the employee (no-login) self-pay
// flow. Separate from the AO OTP store, which is keyed by officer.
const EmployeeOtpSchema = new mongoose.Schema(
  {
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true, unique: true },
    phone: { type: String, required: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-remove challenge docs once they expire.
EmployeeOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.EmployeeOtp || mongoose.model('EmployeeOtp', EmployeeOtpSchema);
