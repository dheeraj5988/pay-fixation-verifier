import mongoose from 'mongoose';

// Phone-keyed OTP challenge for the wizard's Step 0 identity check (there is no
// submission yet at that point). Separate from EmployeeOtp (submission-keyed)
// and the AO OTP store (officer-keyed).
const WizardStartOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

WizardStartOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.WizardStartOtp || mongoose.model('WizardStartOtp', WizardStartOtpSchema);
