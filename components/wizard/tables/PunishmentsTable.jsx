'use client';

import { PUNISHMENT_TYPES, PUNISHMENT_TYPE_LABELS, labelFor } from '@/lib/wizardConstants';
import { emptyPunishment } from '@/lib/wizardDefaults';

const cellInput =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export default function PunishmentsTable({ rows, onChange }) {
  const addRow = () => onChange([...rows, emptyPunishment()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Punishments <span className="font-normal text-slate-400">({rows.length})</span>
        </h3>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          + Add Punishment
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          No punishments recorded.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Duration (months)</th>
                <th className="px-2 py-2">Cumulative</th>
                <th className="px-2 py-2">Notes</th>
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
                  <td className="px-2 py-2 min-w-[200px]">
                    <select
                      value={row.type}
                      onChange={(e) => updateRow(i, 'type', e.target.value)}
                      className={cellInput}
                    >
                      <option value="">— select —</option>
                      {PUNISHMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {labelFor(t, PUNISHMENT_TYPE_LABELS)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.durationMonths}
                      onChange={(e) => updateRow(i, 'durationMonths', e.target.value)}
                      className={cellInput}
                      placeholder="e.g. 12"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.withCumulativeEffect}
                      onChange={(e) => updateRow(i, 'withCumulativeEffect', e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(i, 'notes', e.target.value)}
                      className={cellInput}
                      placeholder="optional"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="rounded p-1 text-red-500 hover:bg-red-50"
                      aria-label="Remove punishment"
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