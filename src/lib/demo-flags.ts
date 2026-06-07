/* Demo helpers: locked routes, trial countdown, business name. */

export const LOCKED_PATHS = new Set<string>([
  "/offerte", "/b2b", "/entrate-merci", "/fornitori",
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

export function getTrialDaysLeft(userId: string): number {
  const onb = readOnboarding(userId);
  if (!onb?.completedAt) return TRIAL_DAYS;
  const start = new Date(onb.completedAt).getTime();
  if (isNaN(start)) return TRIAL_DAYS;
  const elapsedDays = Math.floor((Date.now() - start) / 86400000);
  return Math.max(0, TRIAL_DAYS - elapsedDays);
}