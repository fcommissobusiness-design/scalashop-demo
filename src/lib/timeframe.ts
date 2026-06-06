export type TimeFrameId =
  | "today" | "yesterday" | "tomorrow"
  | "thisWeek" | "lastWeek"
  | "thisMonth" | "lastMonth"
  | "custom";

export interface TimeFrame {
  id: TimeFrameId;
  label: string;
  start: Date;
  end: Date; // exclusive upper bound
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // lunedì = 0
  return addDays(x, -day);
};
const startOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth()+n); return x; };

export function makeTimeFrame(id: TimeFrameId, customStart?: Date, customEnd?: Date): TimeFrame {
  const now = new Date();
  switch (id) {
    case "today":     return { id, label: "Oggi",                  start: startOfDay(now),                end: addDays(startOfDay(now), 1) };
    case "yesterday": return { id, label: "Ieri",                  start: addDays(startOfDay(now), -1),   end: startOfDay(now) };
    case "tomorrow":  return { id, label: "Domani",                start: addDays(startOfDay(now), 1),    end: addDays(startOfDay(now), 2) };
    case "thisWeek":  return { id, label: "Settimana corrente",    start: startOfWeek(now),               end: addDays(startOfWeek(now), 7) };
    case "lastWeek":  return { id, label: "Settimana precedente",  start: addDays(startOfWeek(now), -7),  end: startOfWeek(now) };
    case "thisMonth": return { id, label: "Mese corrente",         start: startOfMonth(now),              end: addMonths(startOfMonth(now), 1) };
    case "lastMonth": return { id, label: "Mese precedente",       start: addMonths(startOfMonth(now),-1),end: startOfMonth(now) };
    case "custom": {
      const s = customStart ? startOfDay(customStart) : startOfDay(now);
      const e = customEnd ? addDays(startOfDay(customEnd), 1) : addDays(s, 1);
      return { id, label: "Personalizzato", start: s, end: e };
    }
  }
}

export function inFrame(iso: string, f: TimeFrame): boolean {
  const t = +new Date(iso);
  return t >= +f.start && t < +f.end;
}

export const TIME_FRAME_OPTIONS: { id: TimeFrameId; label: string }[] = [
  { id: "today", label: "Oggi" },
  { id: "yesterday", label: "Ieri" },
  { id: "tomorrow", label: "Domani" },
  { id: "thisWeek", label: "Sett. corrente" },
  { id: "lastWeek", label: "Sett. precedente" },
  { id: "thisMonth", label: "Mese corrente" },
  { id: "lastMonth", label: "Mese precedente" },
  { id: "custom", label: "Personalizzato" },
];
