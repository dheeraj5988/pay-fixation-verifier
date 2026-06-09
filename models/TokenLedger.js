import mongoose from 'mongoose';

const TokenLedgerSchema = new mongoose.Schema(
  {
    accountOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountOfficer', required: true },
    delta: { type: Number, required: true, validate: { validator: (v) => v !== 0, message: 'delta must be non-zero' } },
    reason: { type: String, enum: ['purchase', 'redemption', 'admin_grant', 'admin_adjustment'], required: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    relatedSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', default: null },
    balanceAfter: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 500 },
    createdByKind: { type: String, enum: ['system', 'account_officer', 'official'], required: true },
    createdByRef: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByRefModel' },
    createdByRefModel: { type: String, enum: ['AccountOfficer', 'OfficialUser', null], default: null },
  },
  { timestamps: true }
);

// Mongoose 9: pre hooks throw synchronously instead of calling next().

// === APPEND-ONLY ENFORCEMENT ===
TokenLedgerSchema.pre('save', function () {
  if (!this.isNew) throw new Error('TokenLedger entries are immutable; create a compensating entry instead');
});

function blockMutation() {
  throw new Error('TokenLedger entries cannot be updated or deleted');
}
TokenLedgerSchema.pre('updateOne', blockMutation);
TokenLedgerSchema.pre('updateMany', blockMutation);
TokenLedgerSchema.pre('findOneAndUpdate', blockMutation);
TokenLedgerSchema.pre('deleteOne', blockMutation);
TokenLedgerSchema.pre('deleteMany', blockMutation);
TokenLedgerSchema.pre('findOneAndDelete', blockMutation);

// reason <-> delta sign consistency
TokenLedgerSchema.pre('validate', function () {
  if (this.reason === 'purchase' && this.delta <= 0) throw new Error('purchase entries must have positive delta');
  if (this.reason === 'redemption' && this.delta >= 0) throw new Error('redemption entries must have negative delta');
  if (this.reason === 'redemption' && !this.relatedSubmission) throw new Error('redemption entries must reference a submission');
  if (this.reason === 'purchase' && !this.relatedOrder) throw new Error('purchase entries must reference an order');
});

TokenLedgerSchema.index({ accountOfficer: 1, createdAt: -1 });
TokenLedgerSchema.index({ relatedOrder: 1 });
TokenLedgerSchema.index({ relatedSubmission: 1 });
TokenLedgerSchema.index({ reason: 1, createdAt: -1 });

export default mongoose.models.TokenLedger || mongoose.model('TokenLedger', TokenLedgerSchema);
