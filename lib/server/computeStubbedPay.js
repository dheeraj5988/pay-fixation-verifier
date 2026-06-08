// ⚠️ PLACEHOLDER ENGINE — DEMO ONLY.
// Returns illustrative, deterministic figures derived loosely from the form
// inputs. These are NOT real Rajasthan FD pay fixations and must never be
// presented to a user as their actual pay. The real deterministic chain-walk
// engine (walkChain) replaces this in a later phase. Every result is tagged
// isMock: true so downstream code can guard against treating it as authoritative.

const DEMO_FLOOR = 18000; // 7CPC L-1 first cell — a sane display floor only

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundTen(n) {
  return Math.round(n / 10) * 10;
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function estimateYears(fromDate, toDate, doj) {
  const start = parseDate(fromDate) || parseDate(doj);
  const end = parseDate(toDate) || new Date();
  if (!start) return 0;
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? ms / (365.25 * 24 * 3600 * 1000) : 0;
}

export function computeStubbedPay(data) {
  const startingBasic = toNum(data.startingBasic) || DEMO_FLOOR;

  const upgradeCount = (data.events || []).filter((e) =>
    /Promotion|ACP|MACP|Selection/i.test(e?.type || '')
  ).length;

  const years = estimateYears(data.fromDate, data.toDate, data.doj);

  // Purely illustrative growth: ~3% compounding per year plus a small bump per
  // upgrade-like event. No bearing whatsoever on real fixation rules.
  const growthFactor = Math.pow(1.03, years) * (1 + 0.04 * upgradeCount);
  const startingSalary = roundTen(startingBasic);
  const currentSalary = roundTen(startingBasic * growthFactor);

  return {
    startingSalary,
    currentSalary,
    traceLines: [
      `[DEMO] Start anchor: ${data.startCpc}th CPC, basic Rs.${startingSalary.toLocaleString('en-IN')}`,
      `[DEMO] Chain span ~${years.toFixed(1)} year(s), ${upgradeCount} upgrade-type event(s) detected`,
      `[DEMO] Illustrative current basic Rs.${currentSalary.toLocaleString('en-IN')}`,
      `[DEMO] Figures are placeholders — not a real pay fixation.`,
    ],
    isMock: true,
    engine: 'computeStubbedPay@demo',
  };
}