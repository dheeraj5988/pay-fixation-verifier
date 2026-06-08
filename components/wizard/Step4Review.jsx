'use client';

import {
  EVENT_TYPE_LABELS,
  PUNISHMENT_TYPE_LABELS,
  labelFor,
} from '@/lib/wizardConstants';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">
        {value || <span className="text-slate-300">—</span>}
      </span>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function Step4Review({ form }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Step 4 — Final Review</h2>
      <p className="mt-1 text-sm text-slate-500">
        Confirm the details below before computing. You can jump back to any step to edit.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SectionCard title="Employee Details">
          <Row label="Name" value={form.name} />
          <Row label="Designation" value={form.designation} />
          <Row label="Department" value={form.department} />
          <Row label="Belt / Emp No." value={form.beltNo} />
          <Row label="Date of Birth" value={form.dob} />
          <Row label="Date of Joining" value={form.doj} />
          <Row label="Date of Retirement" value={form.dor} />
          <Row label="Probation Date" value={form.probationDate} />
          <Row label="Status" value={form.status} />
          <Row label="Joining Time" value={form.joiningTime} />
          <Row label="NPA" value={form.npaFlag ? 'Yes' : 'No'} />
        </SectionCard>

        <SectionCard title="Starting Pay Anchor">
          <Row label="Starting CPC" value={`${form.startCpc}th CPC`} />
          <Row label="Scale / Level" value={form.scaleOrLevel} />
          <Row label="Starting Basic" value={form.startingBasic && `₹${Number(form.startingBasic).toLocaleString('en-IN')}`} />
          <Row label="Grade Pay" value={form.gradePay && `₹${Number(form.gradePay).toLocaleString('en-IN')}`} />
          <Row label="Walk From" value={form.fromDate} />
          <Row label="Walk To" value={form.toDate} />
          <Row label="4→5 Option" value={form.optionDates.c4to5} />
          <Row label="5→6 Option" value={form.optionDates.c5to6} />
          <Row label="6→7 Option" value={form.optionDates.c6to7} />
          <Row label="SFR Re-option" value={form.optionDates.sfrReOption} />
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard title={`Events (${form.events.length})`}>
          {form.events.length === 0 ? (
            <p className="text-xs text-slate-400">None</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {form.events.map((ev, i) => (
                <li key={i} className="rounded bg-white px-2 py-1.5 ring-1 ring-slate-100">
                  <span className="font-medium text-slate-700">
                    {labelFor(ev.type, EVENT_TYPE_LABELS)}
                  </span>
                  <span className="text-slate-400"> · {ev.date || 'no date'}</span>
                  {ev.toLevel && <span className="text-slate-400"> → {ev.toLevel}</span>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Punishments (${form.punishments.length})`}>
          {form.punishments.length === 0 ? (
            <p className="text-xs text-slate-400">None</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {form.punishments.map((p, i) => (
                <li key={i} className="rounded bg-white px-2 py-1.5 ring-1 ring-slate-100">
                  <span className="font-medium text-slate-700">
                    {labelFor(p.type, PUNISHMENT_TYPE_LABELS)}
                  </span>
                  <span className="text-slate-400"> · {p.date || 'no date'}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Leaves (${form.leaves.length})`}>
          {form.leaves.length === 0 ? (
            <p className="text-xs text-slate-400">None</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {form.leaves.map((l, i) => (
                <li key={i} className="rounded bg-white px-2 py-1.5 ring-1 ring-slate-100">
                  <span className="font-medium text-slate-700">{l.type}</span>
                  <span className="text-slate-400"> · {l.fromDate} → {l.toDate}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 rounded-lg bg-amber-50 p-4 text-xs text-amber-800 ring-1 ring-amber-200">
        Clicking “Compute Pay Fixation” will run the <strong>demo</strong> engine and show
        illustrative figures only. No real fixation is performed and no payment is taken in this phase.
      </div>
    </section>
  );
}