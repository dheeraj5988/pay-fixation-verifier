import mongoose from 'mongoose';

const TokenBundleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
    tokenQuantity: { type: Number, required: true, min: 1 },
    priceInPaise: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdByOfficial: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficialUser' },
  },
  { timestamps: true }
);

TokenBundleSchema.index({ isActive: 1, displayOrder: 1 });

export default mongoose.models.TokenBundle || mongoose.model('TokenBundle', TokenBundleSchema);
