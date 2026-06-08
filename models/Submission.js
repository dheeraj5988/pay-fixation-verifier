import mongoose from 'mongoose';

const EVENT_TYPES = [
  'Promotion', 'ACP', 'ACP1', 'ACP2', 'ACP3', 'MACP',
  'Selection_Grade_1', 'Selection_Grade_2', 'Selection_Grade_3', 'Selection_Scale',
  'Scale_FurtherRevised', 'DPC', 'Stepping_Up', 'Probation_OnHigherPost',
  'Court_Order', 'Inter_Service_Transfer', 'Dies_Non', 'Suspension_Start',
  'Restoration', 'NPA_Start', 'NPA_Stop', 'Personal_Pay_Carry',
  'Advance_Increment_PG_Medical', 'Advance_Increment_General', 'Resignation',
];

const PUNISHMENT_TYPES = [
  'Censure', 'Withholding_of_Increment', 'Reduction_in_Rank',
  'Compulsory_Retirement', 'Removal', 'Dismissal',
];

const LEAVE_TYPES = ['EOL', 'Maternity', 'Paternity', 'Study', 'Other'];

const EventSubSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    toLevel: { type: String, trim: true },
    option: { type: String, enum: ['DATE_OF_PROMOTION', 'DNI', ''], default: '' },
    manualBasic: { type: Number, min: 0 },
    cashDate: { type: Date },
    manualMode: { type: Boolean, default: false },
    juniorBasic: { type: Number, min: 0 },
  },
  { _id: false }
);

const PunishmentSubSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: PUNISHMENT_TYPES, required: true },
    durationMonths: { type: Number, min: 0 },
    withCumulativeEffect: { type: Boolean, default: false },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const LeaveSubSchema = new mongoose.Schema(
  {
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const OptionDatesSubSchema = new mongoose.Schema(
  { c4to5: { type: Date }, c5to6: { type: Date }, c6to7: { type: Date }, sfrReOption: { type: Date } },
  { _id: false }
);

const ComputedResultSubSchema = new mongoose.Schema(
  {
    startingSalary: { type: Number },
    currentSalary: { type: Number },
    traceLines: [{ type: String }],
    isMock: { type: Boolean, default: true },
    computedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OtpVerificationSubSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    codeHash: { type: String },
    expiresAt: { type: Date },
    attempts: { type: Number, default: 0, max: 5 },
  },
  { _id: false }
);

const SubmissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    dob: { type: Date, required: true },
    doj: { type: Date, required: true },
    dor: { type: Date },
    designation: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, required: true, trim: true, maxlength: 200 },
    departmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    beltNo: { type: String, trim: true, maxlength: 50 },
    status: { type: String, trim: true, maxlength: 100 },
    npaFlag: { type: Boolean, default: false },
    probationDate: { type: Date },
    joiningTime: { type: String, enum: ['FN', 'AN'], required: true },

    startCpc: { type: Number, enum: [4, 5, 6, 7], required: true },
    scaleOrLevel: { type: String, required: true, trim: true },
    startingBasic: { type: Number, required: true, min: 0 },
    gradePay: { type: Number, min: 0 },

    fromDate: { type: Date },
    toDate: { type: Date },
    optionDates: { type: OptionDatesSubSchema, default: () => ({}) },

    events: [EventSubSchema],
    punishments: [PunishmentSubSchema],
    leaves: [LeaveSubSchema],

    computedResult: { type: ComputedResultSubSchema, default: () => ({}) },
    otpVerification: { type: OtpVerificationSubSchema, default: () => ({}) },

    status_flow: {
      type: String,
      enum: ['draft', 'computed', 'otp_pending', 'otp_verified', 'paid', 'unlocked'],
      default: 'draft',
    },
    ipHash: { type: String, select: false },
  },
  { timestamps: true }
);

SubmissionSchema.index({ department: 1 });
SubmissionSchema.index({ departmentRef: 1 });
SubmissionSchema.index({ 'otpVerification.phone': 1 });
SubmissionSchema.index({ status_flow: 1, createdAt: -1 });
SubmissionSchema.index({ createdAt: -1 });

export default mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
