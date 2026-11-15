// Small display helpers shared by the order screens.

/** "0555123456" → "0555 12 34 56". */
export function prettyPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return phone;
}

/** «1 500 دج», or the label for a price the shop sets at confirmation. */
export function formatDzd(value: number) {
  return `${value.toLocaleString("ar-DZ")} دج`;
}
