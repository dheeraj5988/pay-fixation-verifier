// Maps a Zod-validated submission payload (all strings, "" for blanks) into a
// Mongoose-ready plain object: proper Date/Number types, empty optionals omitted.
// Does NOT drop array rows — strict upstream validation means every row is complete.

function toDate(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
function toNum(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function cleanStr(v) {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}
function put(target, key, value) {
  if (value !== undefined) target[key] = value;
}

function mapEvent(ev) {
  const out = { date: toDate(ev.date), type: ev.type };
  put(out, 'toLevel', cleanStr(ev.toLevel));
  if (ev.option !== undefined) out.option = ev.option;
  put(out, 'manualBasic', toNum(ev.manualBasic));
  put(out, 'cashDate', toDate(ev.cashDate));
  put(out, 'juniorBasic', toNum(ev.juniorBasic));
  return out;
}
function mapPunishment(p) {
  const out = { date: toDate(p.date), type: p.type };
  put(out, 'durationMonths', toNum(p.durationMonths));
  if (typeof p.withCumulativeEffect === 'boolean') out.withCumulativeEffect = p.withCumulativeEffect;
  put(out, 'notes', cleanStr(p.notes));
  return out;
}
function mapLeave(l) {
  const out = { fromDate: toDate(l.fromDate), toDate: toDate(l.toDate), type: l.type };
  put(out, 'notes', cleanStr(l.notes));
  return out;
}

export function mapSubmission(data) {
  const doc = {
    name: cleanStr(data.name),
    designation: cleanStr(data.designation),
    department: cleanStr(data.department),
    npaFlag: !!data.npaFlag,
    joiningTime: data.joiningTime,
    startCpc: data.startCpc,
    scaleOrLevel: cleanStr(data.scaleOrLevel),
    startingBasic: toNum(data.startingBasic),
  };

  put(doc, 'dob', toDate(data.dob));
  put(doc, 'doj', toDate(data.doj));
  put(doc, 'dor', toDate(data.dor));
  put(doc, 'beltNo', cleanStr(data.beltNo));
  put(doc, 'status', cleanStr(data.status));
  put(doc, 'probationDate', toDate(data.probationDate));
  put(doc, 'gradePay', toNum(data.gradePay));
  put(doc, 'fromDate', toDate(data.fromDate));
  put(doc, 'toDate', toDate(data.toDate));

  const od = data.optionDates || {};
  const optionDates = {};
  put(optionDates, 'c4to5', toDate(od.c4to5));
  put(optionDates, 'c5to6', toDate(od.c5to6));
  put(optionDates, 'c6to7', toDate(od.c6to7));
  put(optionDates, 'sfrReOption', toDate(od.sfrReOption));
  if (Object.keys(optionDates).length) doc.optionDates = optionDates;

  doc.events = (data.events || []).map(mapEvent);
  doc.punishments = (data.punishments || []).map(mapPunishment);
  doc.leaves = (data.leaves || []).map(mapLeave);

  return doc;
}
