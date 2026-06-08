import { useRef } from "react";

/**
 * Date box clickable in any point. Wraps a native date input and forwards
 * clicks anywhere on the box to the underlying picker.
 */
export function CustomDateBox({
  label, value, onChange, min, max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const el = ref.current;
    if (!el) return;
    try {
      // showPicker is supported in modern browsers
      (el as any).showPicker?.();
    } catch { /* ignore */ }
    el.focus();
  };
  return (
    <button type="button" onClick={openPicker}
      className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex items-center gap-2 cursor-pointer hover:border-brand-gold/40 transition text-left">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
      <input ref={ref} type="date" value={value} min={min} max={max}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent outline-none text-xs cursor-pointer" />
    </button>
  );
}