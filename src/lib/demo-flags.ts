/* Demo helpers: locked routes, trial countdown, business name. */
import { getDemoMeta, patchDemoMeta } from "./store";

export const LOCKED_PATHS = new Set<string>([
  "/offerte", "/b2b", "/entrate-merci", "/fornitori", "/previsioni-giornaliere",
  "/produzione", "/food-safety", "/ecommerce",
  "/fatture", "/pagamenti", "/finanza", "/fiscale",
  "/report", "/cestino",
]);

export function isLockedPath(path: string): boolean {
  if (LOCKED_PATHS.has(path)) return true;
  for (const p of LOCKED_PATHS) if (path.startsWith(p + "/")) return true;
  return false;
}

const ONB_KEY = "scalashop-onboarding";
const TRIAL_DAYS = 14;
const TRIAL_START_KEY = "scalashop-trial-start";

export type OnbData = {
  businessName?: string;
  businessType?: string;
  completedAt?: string;
};

export function readOnboarding(userId: string): OnbData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${ONB_KEY}:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as OnbData;
  } catch { return null; }
}

export function getBusinessName(userId: string): string {
  return readOnboarding(userId)?.businessName?.trim() || "";
}

/** Trial inizia alla PRIMA entrata effettiva nella demo (dopo registrazione + onboarding).
 *  La sorgente di verità è il cloud (user_state.__demoMeta.trialStart): così lo stesso
 *  account vede lo stesso countdown da qualsiasi dispositivo. localStorage è solo
 *  fallback per la primissima sessione prima dell'idratazione cloud. */
export function getTrialStart(userId: string): number {
  // 1) Cloud (preferito, sincronizzato multi-device)
  try {
    const meta = getDemoMeta();
    if (meta?.trialStart && meta.trialStart > 0) return meta.trialStart;
  } catch {}
  // 2) Fallback locale (legacy / pre-hydrate)
  if (typeof window === "undefined") return Date.now();
  const raw = localStorage.getItem(`${TRIAL_START_KEY}:${userId}`);
  if (raw) {
    const n = Number(raw);
    if (!isNaN(n) && n > 0) return n;
  }
  const onb = readOnboarding(userId);
  if (onb?.completedAt) {
    const t = new Date(onb.completedAt).getTime();
    if (!isNaN(t)) {
      localStorage.setItem(`${TRIAL_START_KEY}:${userId}`, String(t));
      return t;
    }
  }
  return 0;
}

export function ensureTrialStarted(userId: string): number {
  const existing = getTrialStart(userId);
  if (existing > 0) {
    // Se è stato letto da locale o onboarding, propagalo anche nel cloud.
    try {
      if (!getDemoMeta()?.trialStart) patchDemoMeta({ trialStart: existing });
    } catch {}
    return existing;
  }
  const now = Date.now();
  if (typeof window !== "undefined") localStorage.setItem(`${TRIAL_START_KEY}:${userId}`, String(now));
  try {
    patchDemoMeta({ trialStart: now });
  } catch {}
  return now;
}

export function getTrialDaysLeft(userId: string): number {
  const start = getTrialStart(userId);
  if (!start) return TRIAL_DAYS;
  const elapsedDays = Math.floor((Date.now() - start) / 86400000);
  return Math.max(0, TRIAL_DAYS - elapsedDays);
}

export function isTrialExpired(userId: string): boolean {
  const start = getTrialStart(userId);
  if (!start) return false;
  return Date.now() - start > TRIAL_DAYS * 86400000;
}