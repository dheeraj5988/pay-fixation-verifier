import mongoose from 'mongoose';

const ProcessingLogSchema = new mongoose.Schema(
  {
    accountOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountOfficer', required: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    departmentNameSnapshot: { type: String, trim: true },
    processingMethod: { type: String, enum: ['token_redemption', 'direct_payment'], required: true },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    relatedLedgerEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'TokenLedger', default: null },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProcessingLogSchema.index({ accountOfficer: 1, submission: 1 }, { unique: true });
ProcessingLogSchema.index({ department: 1, processedAt: -1 });
ProcessingLogSchema.index({ accountOfficer: 1, processedAt: -1 });
ProcessingLogSchema.index({ processedAt: -1 });

ProcessingLogSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('ProcessingLog entries are immutable'));
  next();
});

const blockMutation = function (next) {
  next(new Error('ProcessingLog entries cannot be updated or deleted'));
};
ProcessingLogSchema.pre('updateOne', blockMutation);
ProcessingLogSchema.pre('updateMany', blockMutation);
ProcessingLogSchema.pre('findOneAndUpdate', blockMutation);
ProcessingLogSchema.pre('deleteOne', blockMutation);
ProcessingLogSchema.pre('deleteMany', blockMutation);
ProcessingLogSchema.pre('findOneAndDelete', blockMutation);

export default mongoose.models.ProcessingLog || mongoose.model('ProcessingLog', ProcessingLogSchema);
