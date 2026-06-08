'use client';

import { EVENT_TYPES, FIXATION_OPTIONS, EVENT_TYPE_LABELS, labelFor } from '@/lib/wizardConstants';
import { emptyEvent } from '@/lib/wizardDefaults';

const cellInput =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export default function EventsTable({ rows, onChange }) {
  const addRow = () => onChange([...rows, emptyEvent()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Events <span className="font-normal text-slate-400">({rows.length})</span>
        </h3>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          + Add Event
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          No events added. Click “Add Event” to record promotions, ACP/MACP, SFR, etc.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Target Level/Scale</th>
                <th className="px-2 py-2">Option</th>
                <th className="px-2 py-2">Manual Basic</th>
                <th className="px-2 py-2">Cash Date</th>
                <th className="px-2 py-2">Junior Basic</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(i, 'date', e.target.value)}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[180px]">
                    <select
                      value={row.type}
                      onChange={(e) => updateRow(i, 'type', e.target.value)}
                      className={cellInput}
                    >
                      <option value="">— select —</option>
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {labelFor(t, EVENT_TYPE_LABELS)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.toLevel}
                      onChange={(e) => updateRow(i, 'toLevel', e.target.value)}
                      className={cellInput}
                      placeholder="auto / scale"
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[150px]">
                    <select
                      value={row.option}
                      onChange={(e) => updateRow(i, 'option', e.target.value)}
                      className={cellInput}
                    >
                      {FIXATION_OPTIONS.map((o) => (
                        <option key={o || 'blank'} value={o}>
                          {o === '' ? '— default —' : o === 'DATE_OF_PROMOTION' ? 'Date of Promotion' : 'DNI'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.manualBasic}
                      onChange={(e) => updateRow(i, 'manualBasic', e.target.value)}
                      className={cellInput}
                      placeholder="optional"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row.cashDate}
                      onChange={(e) => updateRow(i, 'cashDate', e.target.value)}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.juniorBasic}
                      onChange={(e) => updateRow(i, 'juniorBasic', e.target.value)}
                      className={cellInput}
                      placeholder="stepping-up"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      aria-label="Remove event"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}