import mongoose from 'mongoose';

const PayerSubSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['submission', 'account_officer'], required: true },
    ref: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'payer.refModel' },
    refModel: { type: String, enum: ['Submission', 'AccountOfficer'], required: true },
    verifiedPhone: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderType: { type: String, enum: ['employee_report', 'ao_report', 'ao_token_bundle'], required: true },
    payer: { type: PayerSubSchema, required: true },
    amountInPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', enum: ['INR'] },
    tokenBundle: { type: mongoose.Schema.Types.ObjectId, ref: 'TokenBundle', default: null },
    tokenQuantity: { type: Number, min: 0, default: 0 },

    // Gateway-neutral payment identifiers.
    gatewayOrderId: { type: String, trim: true, index: true },
    gatewayTxnId: { type: String, trim: true },
    gatewaySignature: { type: String, trim: true, select: false },

    status: { type: String, enum: ['created', 'paid', 'failed', 'verified', 'refunded'], default: 'created' },

    unlockedSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', default: null },
    downloadToken: { type: String, select: false },
    downloadTokenExpiresAt: { type: Date },
    downloadConsumedAt: { type: Date, default: null },

    isTestMode: { type: Boolean, required: true, default: true },
    verifiedAt: { type: Date },
    failureReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// Mongoose 9: pre hooks no longer receive `next` — throw synchronously instead.
OrderSchema.pre('validate', function () {
  if (this.orderType === 'ao_token_bundle') {
    if (!this.tokenBundle || !this.tokenQuantity) {
      throw new Error('ao_token_bundle orders require tokenBundle and tokenQuantity');
    }
  }
  if (this.orderType === 'employee_report') {
    if (this.payer?.kind !== 'submission') {
      throw new Error('employee_report orders must have payer.kind = submission');
    }
    if (!this.payer?.verifiedPhone) {
      throw new Error('employee_report orders require OTP-verified phone on payer');
    }
  }
  if (this.orderType === 'ao_report') {
    if (this.payer?.kind !== 'account_officer') {
      throw new Error('ao_report orders must have payer.kind = account_officer');
    }
    if (!this.unlockedSubmission) {
      throw new Error('ao_report orders must specify unlockedSubmission');
    }
  }
});

OrderSchema.index({ 'payer.ref': 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderType: 1, createdAt: -1 });
OrderSchema.index({ unlockedSubmission: 1 });
OrderSchema.index({ isTestMode: 1, status: 1 });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
