import { useEffect, useState } from "react";

/**
 * Qty editor with - / + and a free-text numeric field.
 * Supports decimal step (kg) and integer step (pezzi/g).
 * Empty input is treated as 0 (and removes the item via onChange).
 */
export function QtyInput({
  value,
  step,
  unit,
  onChange,
}: {
  value: number;
  step: number;
  unit?: string;
  onChange: (qty: number) => void;
}) {
  const [text, setText] = useState<string>(value > 0 ? formatVal(value, step) : "");

  // Sync from outside (e.g. + button or reset)
  useEffect(() => {
    const cur = parseLocale(text);
    if (cur !== value) setText(value > 0 ? formatVal(value, step) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const n = parseLocale(raw);
    if (isNaN(n) || n < 0) return;
    onChange(+n.toFixed(step < 1 ? 3 : 0));
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          const next = Math.max(0, +(value - step).toFixed(3));
          onChange(next);
        }}
        className="w-7 h-7 rounded-full bg-brand-cream text-brand-green font-bold border border-border shrink-0"
      >
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          // allow only digits, dot, comma
          const v = e.target.value.replace(/[^\d.,]/g, "");
          setText(v);
          if (v === "") onChange(0);
          else {
            const n = parseLocale(v);
            if (!isNaN(n) && n >= 0) onChange(+n.toFixed(step < 1 ? 3 : 0));
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder="0"
        aria-label={`Quantità${unit ? ` (${unit})` : ""}`}
        className="w-14 text-center text-sm font-semibold bg-card border border-border rounded-md px-1 py-1"
      />
      <button
        type="button"
        onClick={() => onChange(+(value + step).toFixed(3))}
        className="w-7 h-7 rounded-full bg-brand-green text-brand-cream font-bold shrink-0"
      >
        +
      </button>
      {unit && <span className="text-[10px] text-muted-foreground w-5">{unit}</span>}
    </div>
  );
}

function parseLocale(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(",", "."));
}
function formatVal(n: number, step: number): string {
  if (step >= 1) return String(Math.round(n));
  // strip trailing zeros, italian comma
  return (+n.toFixed(3)).toString().replace(".", ",");
}
