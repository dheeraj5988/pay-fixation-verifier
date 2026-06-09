import { z } from 'zod';
import {
  EVENT_TYPES,
  PUNISHMENT_TYPES,
  LEAVE_TYPES,
  FIXATION_OPTIONS,
  CPC_OPTIONS,
  JOINING_TIME_OPTIONS,
  STATUS_OPTIONS,
} from './wizardConstants';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''));
const numericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Numbers only')
  .or(z.literal(''));

// Shared cross-field refinement so client and server agree.
const dobBeforeDoj = (d) =>
  !d.dob || !d.doj || new Date(d.dob) < new Date(d.doj);
const dobBeforeDojMsg = {
  message: 'Date of Joining must be after Date of Birth',
  path: ['doj'],
};

// === Base object shapes (no refinements — mergeable) ===

export const step1Base = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dob: dateString,
  doj: dateString,
  dor: optionalDate,
  designation: z.string().trim().min(1, 'Designation is required').max(200),
  department: z.string().trim().min(1, 'Department is required').max(200),
  beltNo: z.string().trim().max(50).optional().or(z.literal('')),
  status: z.preprocess(
    (v) => (typeof v === 'string' && STATUS_OPTIONS.includes(v) ? v : 'working'),
    z.enum(STATUS_OPTIONS)
  ),
  npaFlag: z.boolean(),
  probationDate: optionalDate,
  joiningTime: z.enum(JOINING_TIME_OPTIONS),
});

export const step2Base = z.object({
  startCpc: z.number().refine((v) => CPC_OPTIONS.includes(v), 'Invalid CPC'),
  scaleOrLevel: z.string().trim().min(1, 'Scale/Level is required'),
  startingBasic: z.string().regex(/^\d+$/, 'Starting basic must be a number'),
  gradePay: numericString,
  fromDate: optionalDate,
  toDate: optionalDate,
  optionDates: z.object({
    c4to5: optionalDate,
    c5to6: optionalDate,
    c6to7: optionalDate,
    sfrReOption: optionalDate,
  }),
});

const eventRowSchema = z.object({
  date: dateString,
  type: z.enum(EVENT_TYPES),
  toLevel: z.string().trim().optional().or(z.literal('')),
  option: z.enum(FIXATION_OPTIONS),
  manualBasic: numericString,
  cashDate: optionalDate,
  juniorBasic: numericString,
});

const punishmentRowSchema = z.object({
  date: dateString,
  type: z.enum(PUNISHMENT_TYPES),
  durationMonths: numericString,
  withCumulativeEffect: z.boolean(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const leaveRowSchema = z
  .object({
    fromDate: dateString,
    toDate: dateString,
    type: z.enum(LEAVE_TYPES),
    notes: z.string().max(500).optional().or(z.literal('')),
  })
  .refine((d) => new Date(d.fromDate) <= new Date(d.toDate), {
    message: 'From date must be ≤ To date',
    path: ['toDate'],
  });

export const step3Base = z.object({
  events: z.array(eventRowSchema),
  punishments: z.array(punishmentRowSchema),
  leaves: z.array(leaveRowSchema),
});

// === Per-step schemas (with refinements) — used by the client wizard ===

export const step1Schema = step1Base.refine(dobBeforeDoj, dobBeforeDojMsg);
export const step2Schema = step2Base;
export const step3Schema = step3Base;

// === Full schema — used by the server to validate the whole payload ===

export const fullSubmissionSchema = step1Base
  .merge(step2Base)
  .merge(step3Base)
  .refine(dobBeforeDoj, dobBeforeDojMsg);

export function validateStep(step, data) {
  const schema = { 1: step1Schema, 2: step2Schema, 3: step3Schema }[step];
  if (!schema) return { success: true, errors: {} };
  const result = schema.safeParse(data);
  if (result.success) return { success: true, errors: {} };
  const errors = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return { success: false, errors };
}