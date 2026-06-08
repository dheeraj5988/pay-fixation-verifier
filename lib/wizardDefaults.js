export const emptyEvent = () => ({
  date: '',
  type: '',
  toLevel: '',
  option: '',
  manualBasic: '',
  cashDate: '',
  juniorBasic: '',
});

export const emptyPunishment = () => ({
  date: '',
  type: '',
  durationMonths: '',
  withCumulativeEffect: false,
  notes: '',
});

export const emptyLeave = () => ({
  fromDate: '',
  toDate: '',
  type: '',
  notes: '',
});

export const emptyForm = () => ({
  // Step 1
  name: '',
  dob: '',
  doj: '',
  dor: '',
  designation: '',
  department: '',
  beltNo: '',
  status: '',
  npaFlag: false,
  probationDate: '',
  joiningTime: 'FN',

  // Step 2
  startCpc: 7,
  scaleOrLevel: '',
  startingBasic: '',
  gradePay: '',
  fromDate: '',
  toDate: '',
  optionDates: {
    c4to5: '',
    c5to6: '',
    c6to7: '',
    sfrReOption: '',
  },

  // Step 3
  events: [],
  punishments: [],
  leaves: [],
});