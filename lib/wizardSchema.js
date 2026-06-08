import { z } from 'zod';
import {
  EVENT_TYPES,
  PUNISHMENT_TYPES,
  LEAVE_TYPES,
  FIXATION_OPTIONS,
  CPC_OPTIONS,
  JOINING_TIME_OPTIONS,
} from './wizardConstants';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''));
const numericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Numbers only')
  .or(z.literal(''));

export const step1Schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dob: dateString,
  doj: dateString,
  dor: optionalDate,
  designation: z.string().trim().min(1, 'Designation is required').max(200),
  department: z.string().trim().min(1, 'Department is required').max(200),
  beltNo: z.string().trim().max(50).optional().or(z.literal('')),
  status: z.string().trim().max(100).optional().or(z.literal('')),
  npaFlag: z.boolean(),
  probationDate: optionalDate,
  joiningTime: z.enum(JOINING_TIME_OPTIONS),
}).refine((d) => new Date(d.dob) < new Date(d.doj), {
  message: 'Date of Joining must be after Date of Birth',
  path: ['doj'],
});

export const step2Schema = z.object({
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

const leaveRowSchema = z.object({
  fromDate: dateString,
  toDate: dateString,
  type: z.enum(LEAVE_TYPES),
  notes: z.string().max(500).optional().or(z.literal('')),
}).refine((d) => new Date(d.fromDate) <= new Date(d.toDate), {
  message: 'From date must be ≤ To date',
  path: ['toDate'],
});

export const step3Schema = z.object({
  events: z.array(eventRowSchema),
  punishments: z.array(punishmentRowSchema),
  leaves: z.array(leaveRowSchema),
});

export function validateStep(step, data) {
  const schema = { 1: step1Schema, 2: step2Schema, 3: step3Schema }[step];
  if (!schema) return { success: true, errors: {} };
  const result = schema.safeParse(data);
  if (result.success) return { success: true, errors: {} };
  const errors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }
  return { success: false, errors };
}

export const fullSubmissionSchema = ...