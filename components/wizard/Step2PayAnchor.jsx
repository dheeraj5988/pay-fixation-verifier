'use client';

import { CPC_OPTIONS } from '@/lib/wizardConstants';

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

export default function Step2PayAnchor({ form, errors, updateField }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">Step 2 — Starting Pay Anchor</h2>
      <p className="mt-1 text-sm text-slate-500">
        The pay commission, scale/level, and basic pay at the start of the chain you want walked.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Starting CPC" required error={errors.startCpc}>
          <select
            value={form.startCpc}
            onChange={(e) => updateField('startCpc', Number(e.target.value))}
            className={inputCls}
          >
            {CPC_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}th CPC
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Scale / Level"
          required
          error={errors.scaleOrLevel}
          hint="Pre-7CPC: scale string (e.g. 5500-175-9000). 7CPC: level (e.g. L-10)."
        >
          <input
            type="text"
            value={form.scaleOrLevel}
            onChange={(e) => updateField('scaleOrLevel', e.target.value)}
            className={inputCls}
            placeholder="e.g. L-10 or 5500-175-9000"
          />
        </Field>

        <Field label="Starting Basic" required error={errors.startingBasic}>
          <input
            type="text"
            inputMode="numeric"
            value={form.startingBasic}
            onChange={(e) => updateField('startingBasic', e.target.value)}
            className={inputCls}
            placeholder="e.g. 44900"
          />
        </Field>

        <Field
          label="Grade Pay"
          error={errors.gradePay}
          hint="6CPC era only. Leave blank for 4/5/7 CPC."
        >
          <input
            type="text"
            inputMode="numeric"
            value={form.gradePay}
            onChange={(e) => updateField('gradePay', e.target.value)}
            className={inputCls}
            placeholder="e.g. 4200"
          />
        </Field>

        <Field label="Walk From Date" error={errors.fromDate} hint="Defaults to Date of Joining if blank.">
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => updateField('fromDate', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Walk To Date" error={errors.toDate} hint="Defaults to today / retirement if blank.">
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => updateField('toDate', e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <fieldset className="mt-8 rounded-xl border border-slate-200 p-5">
        <legend className="px-2 text-sm font-semibold text-slate-700">
          CPC Option Dates <span className="font-normal text-slate-400">(optional)</span>
        </legend>
        <p className="mb-4 text-xs text-slate-500">
          Set these only if the employee opted for a non-default fixation date at a CPC
          transition, or for a Scale-Further-Revised re-option.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="4→5 CPC" error={errors['optionDates.c4to5']}>
            <input
              type="date"
              value={form.optionDates.c4to5}
              onChange={(e) => updateField('optionDates.c4to5', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="5→6 CPC" error={errors['optionDates.c5to6']}>
            <input
              type="date"
              value={form.optionDates.c5to6}
              onChange={(e) => updateField('optionDates.c5to6', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="6→7 CPC" error={errors['optionDates.c6to7']}>
            <input
              type="date"
              value={form.optionDates.c6to7}
              onChange={(e) => updateField('optionDates.c6to7', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="SFR Re-option" error={errors['optionDates.sfrReOption']}>
            <input
              type="date"
              value={form.optionDates.sfrReOption}
              onChange={(e) => updateField('optionDates.sfrReOption', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </fieldset>
    </section>
  );
}