'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from './StepIndicator';
import Step1EmployeeDetails from './Step1EmployeeDetails';
import Step2PayAnchor from './Step2PayAnchor';
import Step3ChainHistory from './Step3ChainHistory';
import Step4Review from './Step4Review';
import { emptyForm } from '@/lib/wizardDefaults';
import {
  loadDraft, saveDraft, loadStep, saveStep, clearDraft, debounce,
} from '@/lib/wizardStorage';
import { validateStep } from '@/lib/wizardSchema';

export default function SubmissionWizard() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) setForm({ ...emptyForm(), ...draft });
    const savedStep = loadStep();
    setStep(savedStep);
    setMaxReached(savedStep);
    setHydrated(true);
  }, []);

  const persistRef = useRef(debounce((data) => saveDraft(data), 400));
  useEffect(() => {
    if (!hydrated) return;
    persistRef.current(form);
  }, [form, hydrated]);

  useEffect(() => {
    if (hydrated) saveStep(step);
  }, [step, hydrated]);

  const updateField = (path, value) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      const parts = path.split('.');
      let target = next;
      for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
      target[parts.at(-1)] = value;
      return next;
    });
  };

  const replaceArray = (key, arr) => {
    setForm((prev) => ({ ...prev, [key]: arr }));
  };

  const goToStep = (n) => {
    if (n < 1 || n > 4) return;
    if (n <= maxReached) {
      setStep(n);
      setErrors({});
    }
  };

  const handleNext = () => {
    const dataForStep = pickStepData(form, step);
    const { success, errors: stepErrors } = validateStep(step, dataForStep);
    if (!success) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    const nextStep = Math.min(step + 1, 4);
    setStep(nextStep);
    setMaxReached((m) => Math.max(m, nextStep));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= 3; s++) {
      const { success, errors: stepErrors } = validateStep(s, pickStepData(form, s));
      if (!success) {
        setStep(s);
        setErrors(stepErrors);
        return;
      }
    }
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        if (json.errors && Object.keys(json.errors).length) {
          setErrors(json.errors);
          setStep(stepForErrorKeys(Object.keys(json.errors)));
        } else {
          setErrors({ _form: json.error || 'Submission failed. Please try again.' });
        }
        setSubmitting(false);
        return;
      }

      const id = json.submission?.id || json.submission?._id;
      if (!id) {
        setErrors({ _form: 'Submission saved, but no reference was returned. Please try again.' });
        setSubmitting(false);
        return;
      }

      // The submission is now persisted with a real id. Navigate to the
      // standalone checkout URL so it has real browser history (back button
      // works, refresh works, the AO-login round-trip returns here cleanly).
      clearDraft();
      router.push(`/checkout?submission=${id}`);
      // Keep `submitting` true — navigation unmounts this component.
    } catch (e) {
      setErrors({ _form: 'Network error — could not reach the server. Is the dev server running?' });
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <StepIndicator current={step} maxReached={maxReached} onStepClick={goToStep} />

      {errors._form && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          {errors._form}
        </div>
      )}

      <div className="min-h-[400px]">
        {step === 1 && (
          <Step1EmployeeDetails form={form} errors={errors} updateField={updateField} />
        )}
        {step === 2 && (
          <Step2PayAnchor form={form} errors={errors} updateField={updateField} />
        )}
        {step === 3 && (
          <Step3ChainHistory form={form} errors={errors} replaceArray={replaceArray} />
        )}
        {step === 4 && <Step4Review form={form} />}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
        >
          ← Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? 'Computing…' : 'Compute Pay Fixation'}
          </button>
        )}
      </div>
    </div>
  );
}

function pickStepData(form, step) {
  if (step === 1) {
    const { name, dob, doj, dor, designation, department, beltNo, status, npaFlag, probationDate, joiningTime } = form;
    return { name, dob, doj, dor, designation, department, beltNo, status, npaFlag, probationDate, joiningTime };
  }
  if (step === 2) {
    const { startCpc, scaleOrLevel, startingBasic, gradePay, fromDate, toDate, optionDates } = form;
    return { startCpc, scaleOrLevel, startingBasic, gradePay, fromDate, toDate, optionDates };
  }
  if (step === 3) {
    const { events, punishments, leaves } = form;
    return { events, punishments, leaves };
  }
  return form;
}

const STEP1_KEYS = new Set([
  'name', 'dob', 'doj', 'dor', 'designation', 'department',
  'beltNo', 'status', 'npaFlag', 'probationDate', 'joiningTime',
]);
const STEP2_KEYS = new Set([
  'startCpc', 'scaleOrLevel', 'startingBasic', 'gradePay', 'fromDate', 'toDate',
]);

function stepForErrorKeys(keys) {
  if (keys.some((k) => STEP1_KEYS.has(k))) return 1;
  if (keys.some((k) => STEP2_KEYS.has(k) || k.startsWith('optionDates'))) return 2;
  if (keys.some((k) => k.startsWith('events') || k.startsWith('punishments') || k.startsWith('leaves'))) return 3;
  return 4;
}
