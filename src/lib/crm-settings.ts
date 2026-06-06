// CRM thresholds: configurabili in Admin, persistite in localStorage
export interface CrmSettings {
  // upgrade
  newDays: number;            // entro X giorni dal primo ordine = "nuovi"
  abitualiMinFreq: number;    // ordini/mese
  topMinLTV: number;          // EUR lifetime
  topMinFreq: number;         // ordini/mese alternativa per top
  // downgrade per inattività (giorni dall'ultima attività)
  inactiveTopDays: number;    // top → abituali
  inactiveAbitualiDays: number; // abituali → occasionali
  inactiveOccDays: number;    // occasionali → inattivi
  // recovery
  recoverableMinDays: number; // soglia "da recuperare" (inattivo non troppo vecchio)
  recoverableMaxDays: number;
  recoverableMinLTV: number;  // solo se ha speso almeno
}

export const CRM_DEFAULTS: CrmSettings = {
  newDays: 60,
  abitualiMinFreq: 1.5,
  topMinLTV: 300,
  topMinFreq: 4,
  inactiveTopDays: 60,
  inactiveAbitualiDays: 45,
  inactiveOccDays: 90,
  recoverableMinDays: 30,
  recoverableMaxDays: 120,
  recoverableMinLTV: 50,
};

const KEY = "sciorio-hq-crm-settings";

export function loadCrmSettings(): CrmSettings {
  if (typeof window === "undefined") return CRM_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return CRM_DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...CRM_DEFAULTS, ...parsed };
  } catch {
    return CRM_DEFAULTS;
  }
}

export function saveCrmSettings(s: CrmSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetCrmSettings() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
