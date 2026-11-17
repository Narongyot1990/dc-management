// Lucide has no "license plate" glyph — a small plate-shaped rect reads clearer
// than the Truck icon, which people mistake for "this is a tractor unit" rather
// than the chassis's own registration number. Shared so every yard-check list
// (summary, inventory check, etc.) draws the chassis plate the same way.
export function PlateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  );
}
