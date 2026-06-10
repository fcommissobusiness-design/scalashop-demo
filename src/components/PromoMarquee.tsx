const PHRASES = [
  "14 giorni di demo gratuita del sistema ScalaShop",
  "Attiva ora il piano a pagamento",
  "Porta un amico e sblocca un coupon",
  "Per te il 20% di sconto sull'attivazione del piano — fino al 31/07/2026",
];

export function PromoMarquee() {
  // Duplico le frasi così il loop visivo è continuo.
  const items = [...PHRASES, ...PHRASES];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => e.preventDefault()}
      className="w-full overflow-hidden bg-brand-gold text-brand-green border-b border-brand-gold/40 cursor-pointer select-none"
      aria-label="Promozioni ScalaShop"
    >
      <style>{`
        @keyframes scalashop-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .scalashop-marquee-track {
          display: inline-flex;
          white-space: nowrap;
          animation: scalashop-marquee 45s linear infinite;
        }
      `}</style>
      <div className="py-1.5 overflow-hidden">
        <div className="scalashop-marquee-track text-[11px] md:text-xs font-semibold tracking-wide">
          {items.map((p, i) => (
            <span key={i} className="px-6 inline-flex items-center gap-2">
              <span className="opacity-70">★</span>
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}