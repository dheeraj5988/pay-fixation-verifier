// scripts/seedDemoData.mjs
//
// Populates the database with realistic demo Submissions and pre-unlocks a few
// of them for the ao_test Account Officer, so the "My Unlocked Reports" library
// and persistent downloads can be tested with a full UI.
//
// Writes through the raw driver (via the Mongoose connection) so it only sets
// the fields the app reads, and tags every doc with seedTag:'demo' so it is
// safely removable and the script is idempotent (re-running replaces the set).
//
// Usage:  node --env-file=.env.local scripts/seedDemoData.mjs
// NOTE: this writes to whatever MONGODB_URI points at — i.e. your live Atlas DB.

import mongoose from 'mongoose';

const SEED_TAG = 'demo';

// Realistic Rajasthan government employee records (illustrative figures).
const SUBMISSIONS = [
  { name: 'Ramesh Chand Meena', designation: 'Senior Teacher', department: 'Education Department', beltNo: 'EDU-48823', dob: '1979-06-12', doj: '2004-08-01', dor: '2039-06-30', startCpc: 6, scaleOrLevel: 'L-11', startingBasic: 9300, gradePay: 4200, fromDate: '2004-08-01', toDate: '2016-01-01', start: 45200, current: 78900 },
  { name: 'Sunita Sharma', designation: 'Junior Accountant', department: 'Finance Department', beltNo: 'FIN-31207', dob: '1985-02-25', doj: '2009-11-15', dor: '2045-02-28', startCpc: 6, scaleOrLevel: 'L-10', startingBasic: 9300, gradePay: 3600, fromDate: '2009-11-15', toDate: '2016-01-01', start: 38600, current: 64500 },
  { name: 'Mahaveer Prasad', designation: 'Patwari', department: 'Revenue Department', beltNo: 'REV-77410', dob: '1982-09-03', doj: '2007-03-20', dor: '2042-09-30', startCpc: 6, scaleOrLevel: 'L-6', startingBasic: 5200, gradePay: 2400, fromDate: '2007-03-20', toDate: '2016-01-01', start: 21300, current: 41800 },
  { name: 'Anita Verma', designation: 'Nurse Grade II', department: 'Medical & Health Department', beltNo: 'MED-55190', dob: '1988-12-18', doj: '2012-07-09', dor: '2048-12-31', startCpc: 6, scaleOrLevel: 'L-8', startingBasic: 9300, gradePay: 3200, fromDate: '2012-07-09', toDate: '2016-01-01', start: 33100, current: 52700 },
  { name: 'Devendra Singh Rathore', designation: 'Assistant Engineer', department: 'Public Health Engineering (PHED)', beltNo: 'PHE-20644', dob: '1980-04-30', doj: '2005-09-12', dor: '2040-04-30', startCpc: 6, scaleOrLevel: 'L-14', startingBasic: 15600, gradePay: 5400, fromDate: '2005-09-12', toDate: '2016-01-01', start: 56800, current: 98400 },
  { name: 'Kavita Jangid', designation: 'Lower Division Clerk', department: 'Panchayati Raj Department', beltNo: 'PR-90318', dob: '1990-08-07', doj: '2014-01-22', dor: '2050-08-31', startCpc: 7, scaleOrLevel: 'L-5', startingBasic: 25500, gradePay: 0, fromDate: '2016-01-01', toDate: '2016-01-01', start: 25500, current: 39200 },
];

function traceLines(name, start, current) {
  return [
    `Pay fixation trace — ${name}`,
    `Anchor basic at entry: Rs. ${start.toLocaleString('en-IN')}`,
    `Merged into 6th CPC pay band + grade pay on 01-01-2006.`,
    `Annual increments applied on 1st July each year.`,
    `Option for fixation exercised from date of next increment.`,
    `Migrated to 7th CPC matrix using fitment factor 2.57 on 01-01-2016.`,
    `Current basic (illustrative): Rs. ${current.toLocaleString('en-IN')}`,
    `NOTE: DEMO figures only — not a certified pay fixation.`,
  ];
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const Submissions = db.collection('submissions');
  const Orders = db.collection('orders');
  const Logs = db.collection('processinglogs');
  const AOs = db.collection('accountofficers');

  const ao = await AOs.findOne({ loginId: 'ao_test' });
  if (!ao) {
    throw new Error('ao_test not found. Run:  node --env-file=.env.local scripts/seedAO.mjs  first.');
  }

  // --- Clean any previous seed set (keeps the script idempotent) ---
  const delLogs = await Logs.deleteMany({ seedTag: SEED_TAG });
  const delOrders = await Orders.deleteMany({ seedTag: SEED_TAG });
  const delSubs = await Submissions.deleteMany({ seedTag: SEED_TAG });
  console.log(`Cleared previous seed: ${delSubs.deletedCount} submissions, ${delOrders.deletedCount} orders, ${delLogs.deletedCount} logs`);

  const now = new Date();
  const subDocs = SUBMISSIONS.map((s) => ({
    _id: new mongoose.Types.ObjectId(),
    name: s.name,
    designation: s.designation,
    department: s.department,
    beltNo: s.beltNo,
    status: 'working',
    dob: new Date(s.dob),
    doj: new Date(s.doj),
    dor: new Date(s.dor),
    startCpc: s.startCpc,
    scaleOrLevel: s.scaleOrLevel,
    startingBasic: s.startingBasic,
    gradePay: s.gradePay,
    fromDate: new Date(s.fromDate),
    toDate: new Date(s.toDate),
    events: [],
    punishments: [],
    leaves: [],
    optionDates: [],
    computedResult: {
      startingSalary: s.start,
      currentSalary: s.current,
      traceLines: traceLines(s.name, s.start, s.current),
      isMock: true,
    },
    seedTag: SEED_TAG,
    createdAt: now,
    updatedAt: now,
  }));
  await Submissions.insertMany(subDocs);
  console.log(`Inserted ${subDocs.length} demo submissions`);

  // --- Pre-unlock the first three for ao_test (mixed methods) ---
  const unlockPlan = [
    { idx: 0, method: 'direct_payment', amountInPaise: 30000, daysAgo: 1 },
    { idx: 1, method: 'direct_payment', amountInPaise: 30000, daysAgo: 4 },
    { idx: 2, method: 'token_redemption', amountInPaise: 0, daysAgo: 9 },
  ];

  const orderDocs = [];
  const logDocs = [];
  for (const u of unlockPlan) {
    const sub = subDocs[u.idx];
    const orderId = new mongoose.Types.ObjectId();
    const when = new Date(now.getTime() - u.daysAgo * 86400000);
    orderDocs.push({
      _id: orderId,
      orderType: 'ao_report',
      payer: { kind: 'account_officer', ref: ao._id, refModel: 'AccountOfficer' },
      unlockedSubmission: sub._id,
      amountInPaise: u.amountInPaise,
      currency: 'INR',
      isTestMode: true,
      status: 'verified',
      seedTag: SEED_TAG,
      createdAt: when,
      updatedAt: when,
    });
    logDocs.push({
      _id: new mongoose.Types.ObjectId(),
      accountOfficer: ao._id,
      submission: sub._id,
      department: ao.department,
      departmentNameSnapshot: sub.department,
      processingMethod: u.method,
      relatedOrder: orderId,
      processedAt: when,
      seedTag: SEED_TAG,
      createdAt: when,
      updatedAt: when,
    });
  }
  await Orders.insertMany(orderDocs);
  await Logs.insertMany(logDocs);

  // Keep the dashboard "Reports Processed" stat consistent across re-runs:
  // net change = (new seed logs) - (seed logs we just deleted).
  const netDelta = logDocs.length - delLogs.deletedCount;
  if (netDelta !== 0) {
    await AOs.updateOne({ _id: ao._id }, { $inc: { reportsProcessedCount: netDelta } });
  }

  const paid = unlockPlan.filter((u) => u.method === 'direct_payment').length;
  const tokens = unlockPlan.filter((u) => u.method === 'token_redemption').length;
  console.log(`Pre-unlocked ${logDocs.length} reports for ao_test (${paid} paid, ${tokens} via tokens).`);
  console.log(`Library should now show ${logDocs.length}; ${subDocs.length - logDocs.length} submissions remain locked for testing fresh unlocks.`);
  console.log('\nTo remove ALL demo data later:');
  console.log("  db.submissions.deleteMany({seedTag:'demo'}); db.orders.deleteMany({seedTag:'demo'}); db.processinglogs.deleteMany({seedTag:'demo'})");

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
