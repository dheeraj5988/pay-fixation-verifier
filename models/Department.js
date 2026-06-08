import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], trim: true, unique: true },
    code: { type: String, required: [true, 'Department code is required'], trim: true, uppercase: true, unique: true, maxlength: 20 },
    assignedOfficers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AccountOfficer' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DepartmentSchema.index({ code: 1 });
DepartmentSchema.index({ name: 'text' });

export default mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
