'use client';

import EventsTable from './tables/EventsTable';
import PunishmentsTable from './tables/PunishmentsTable';
import LeavesTable from './tables/LeavesTable';

export default function Step3ChainHistory({ form, errors, replaceArray }) {
  const hasRowErrors = Object.keys(errors).some(
    (k) => k.startsWith('events.') || k.startsWith('punishments.') || k.startsWith('leaves.')
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Step 3 — Chain History</h2>
      <p className="mt-1 text-sm text-slate-500">
        Add the events, punishments, and leave periods that make up the service chain.
        All three are optional — add only what applies.
      </p>

      {hasRowErrors && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
          Some rows have missing or invalid fields (each row needs at least a valid date and type).
          Please review the highlighted sections.
        </div>
      )}

      <div className="mt-6 space-y-8">
        <EventsTable rows={form.events} onChange={(arr) => replaceArray('events', arr)} />
        <PunishmentsTable rows={form.punishments} onChange={(arr) => replaceArray('punishments', arr)} />
        <LeavesTable rows={form.leaves} onChange={(arr) => replaceArray('leaves', arr)} />
      </div>
    </section>
  );
}