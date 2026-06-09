'use client';

const STORAGE_KEY = 'pfv_wizard_draft_v1';
const STEP_KEY = 'pfv_wizard_step_v1';
const IDENTITY_KEY = 'pfv_wizard_identity_v1';
const IDENTITY_TTL_MS = 2 * 60 * 60 * 1000; // matches the wizard_identity cookie TTL

export function loadDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__v !== 1) return null; // version mismatch → ignore
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveDraft(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ __v: 1, savedAt: Date.now(), data })
    );
  } catch {
    // Quota exceeded or storage disabled — silently skip
  }
}

export function loadStep() {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(STEP_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 1;
  } catch {
    return 1;
  }
}

export function saveStep(step) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STEP_KEY, String(step));
  } catch { /* noop */ }
}

export function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STEP_KEY);
  } catch { /* noop */ }
}

// --- Step 0 identity (client-side UX gate; the server's wizard_identity cookie
// remains the source of truth). Stored separately and NOT cleared by clearDraft,
// so a verified user isn't forced to re-verify between submissions within TTL. ---
export function saveIdentity(obj) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify({ __v: 1, savedAt: Date.now(), data: obj }));
  } catch { /* noop */ }
}

export function loadIdentity() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__v !== 1) return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > IDENTITY_TTL_MS) {
      window.localStorage.removeItem(IDENTITY_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearIdentity() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(IDENTITY_KEY);
  } catch { /* noop */ }
}

// Simple debounce — write at most once per `wait` ms
export function debounce(fn, wait = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
