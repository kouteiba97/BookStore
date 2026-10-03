// Writes import fixtures: node scripts/perf/make-import.mjs <rows> <out.csv> [dupEvery]
import { writeFileSync } from "node:fs";
const [rows, out, dupEvery = "10"] = process.argv.slice(2);
const W = ["شرح","تفسير","الفقه","أصول","العقيدة","المختصر","الجامع","الأحكام","السنن","رياض","زاد","فتح","المغني","الرسالة","الموطأ","البلاغة","النحو","منهج","إحياء","تاريخ"];
const cats = ["فقه","حديث","تفسير","عقيدة","تاريخ","لغة عربية"];
const lines = ["title,author,category,publisher,year"];
const run = Date.now().toString(36);
for (let i = 0; i < Number(rows); i++) {
  // Every Nth row repeats the previous one: the same book listed twice.
  const n = i % Number(dupEvery) === 0 && i > 0 ? i - 1 : i;
  const t = `${W[n % 20]} ${W[(n * 7) % 20]} ${W[(n * 3 + 1) % 20]} ${run}-${n}`;
  lines.push([t, `مؤلف استيراد ${run} ${n % 40}`, cats[n % cats.length], `دار استيراد ${run} ${n % 15}`, 1980 + (n % 40)].map(v => `"${v}"`).join(","));
}
writeFileSync(out, "\ufeff" + lines.join("\n"));
console.log(`${out}: ${rows} rows, unique ≈ ${Number(rows) - Math.floor((Number(rows) - 1) / Number(dupEvery))}`);
