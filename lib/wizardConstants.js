export const EVENT_TYPES = [
  'Promotion',
  'ACP', 'ACP1', 'ACP2', 'ACP3', 'MACP',
  'Selection_Grade_1', 'Selection_Grade_2', 'Selection_Grade_3',
  'Selection_Scale',
  'Scale_FurtherRevised',
  'DPC',
  'Stepping_Up',
  'Probation_OnHigherPost',
  'Court_Order',
  'Inter_Service_Transfer',
  'Dies_Non',
  'Suspension_Start', 'Restoration',
  'NPA_Start', 'NPA_Stop',
  'Personal_Pay_Carry',
  'Advance_Increment_PG_Medical', 'Advance_Increment_General',
  'Resignation',
];

export const PUNISHMENT_TYPES = [
  'Censure',
  'Withholding_of_Increment',
  'Reduction_in_Rank',
  'Compulsory_Retirement',
  'Removal',
  'Dismissal',
];

export const LEAVE_TYPES = ['EOL', 'Maternity', 'Paternity', 'Study', 'Other'];

export const FIXATION_OPTIONS = ['', 'DATE_OF_PROMOTION', 'DNI'];

export const CPC_OPTIONS = [4, 5, 6, 7];

export const JOINING_TIME_OPTIONS = ['FN', 'AN'];

// Friendly labels for UI display (keep enum values machine-clean)
export const EVENT_TYPE_LABELS = {
  Selection_Grade_1: 'Selection Grade 1',
  Selection_Grade_2: 'Selection Grade 2',
  Selection_Grade_3: 'Selection Grade 3',
  Selection_Scale: 'Selection Scale',
  Scale_FurtherRevised: 'Scale Further Revised (SFR)',
  Probation_OnHigherPost: 'Probation on Higher Post',
  Court_Order: 'Court Order',
  Inter_Service_Transfer: 'Inter-Service Transfer',
  Dies_Non: 'Dies Non',
  Suspension_Start: 'Suspension Start',
  NPA_Start: 'NPA Start',
  NPA_Stop: 'NPA Stop',
  Personal_Pay_Carry: 'Personal Pay Carry',
  Advance_Increment_PG_Medical: 'Advance Increment (PG/Medical)',
  Advance_Increment_General: 'Advance Increment (General)',
};

export const PUNISHMENT_TYPE_LABELS = {
  Withholding_of_Increment: 'Withholding of Increment',
  Reduction_in_Rank: 'Reduction in Rank',
  Compulsory_Retirement: 'Compulsory Retirement',
};

export const labelFor = (value, map) => map[value] || value.replace(/_/g, ' ');