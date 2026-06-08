'use client';

import { JOINING_TIME_OPTIONS } from '@/lib/wizardConstants';

function Field({ label, error, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputCls =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

export default function Step1EmployeeDetails({ form, errors, updateField }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">
        Step 1 — Employee &amp; Department Details
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Basic identifying information for the employee record.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Full Name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={inputCls}
            placeholder="e.g. Babulal Meena"
          />
        </Field>

        <Field label="Designation" required error={errors.designation}>
          <input
            type="text"
            value={form.designation}
            onChange={(e) => updateField('designation', e.target.value)}
            className={inputCls}
            placeholder="e.g. Senior Teacher"
          />
        </Field>

        <Field
          label="Department"
          required
          error={errors.department}
          hint="Free text for now — a dropdown will replace this in a later release."
        >
          <input
            type="text"
            value={form.department}
            onChange={(e) => updateField('department', e.target.value)}
            className={inputCls}
            placeholder="e.g. Education Department"
          />
        </Field>

        <Field label="Belt / Employee No." error={errors.beltNo}>
          <input
            type="text"
            value={form.beltNo}
            onChange={(e) => updateField('beltNo', e.target.value)}
            className={inputCls}
            placeholder="optional"
          />
        </Field>

        <Field label="Date of Birth" required error={errors.dob}>
          <input
            type="date"
            value={form.dob}
            onChange={(e) => updateField('dob', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Date of Joining" required error={errors.doj}>
          <input
            type="date"
            value={form.doj}
            onChange={(e) => updateField('doj', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Date of Retirement"
          error={errors.dor}
          hint="Leave blank if still in service."
        >
          <input
            type="date"
            value={form.dor}
            onChange={(e) => updateField('dor', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Probation Completion Date"
          error={errors.probationDate}
          hint="Optional."
        >
          <input
            type="date"
            value={form.probationDate}
            onChange={(e) => updateField('probationDate', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Status" error={errors.status} hint="e.g. Working / Retired / Suspended">
          <input
            type="text"
            value={form.status}
            onChange={(e) => updateField('status', e.target.value)}
            className={inputCls}
            placeholder="optional"
          />
        </Field>

        <Field label="Joining Time" required error={errors.joiningTime}>
          <div className="flex gap-4 pt-1">
            {JOINING_TIME_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="joiningTime"
                  value={opt}
                  checked={form.joiningTime === opt}
                  onChange={(e) => updateField('joiningTime', e.target.value)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                {opt === 'FN' ? 'Forenoon (FN)' : 'Afternoon (AN)'}
              </label>
            ))}
          </div>
        </Field>

        <Field label="NPA Applicable" error={errors.npaFlag} hint="Non-Practising Allowance (medical cadres).">
          <label className="flex items-center gap-2 pt-1 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.npaFlag}
              onChange={(e) => updateField('npaFlag', e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            This employee receives NPA
          </label>
        </Field>
      </div>
    </section>
  );
}