/**
 * Times the read endpoints against a running API.
 *
 *   node scripts/perf/bench.mjs [baseUrl] [slug] [runs]
 *
 * Prints median / p95 wall time and response size per endpoint. Admin
 * endpoints are included when ADMIN_TOKEN is set in the environment.
 */
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const SLUG = process.argv[3] ?? 'perf';
const RUNS = Number(process.argv[4] ?? 15);
const TOKEN = process.env.ADMIN_TOKEN;

const api = `${BASE}/api/v1`;
const pub = `${api}/${SLUG}`;

async function time(url, headers = {}) {
  const t0 = performance.now();
  const res = await fetch(url, { headers });
  const body = await res.arrayBuffer();
  return { ms: performance.now() - t0, bytes: body.byteLength, status: res.status, body };
}

const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

async function bench(name, url, headers) {
  await time(url, headers); // warm-up
  const ms = [];
  let bytes = 0;
  let status = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = await time(url, headers);
    ms.push(r.ms);
    bytes = r.bytes;
    status = r.status;
  }
  console.log(
    `${name.padEnd(28)} ${String(status).padEnd(4)} median ${pct(ms, 50).toFixed(1).padStart(7)} ms   p95 ${pct(ms, 95)
      .toFixed(1)
      .padStart(7)} ms   ${(bytes / 1024).toFixed(1).padStart(8)} KB`,
  );
}

const one = JSON.parse(Buffer.from((await time(`${pub}/books/search?q=${encodeURIComponent('شرح')}`)).body).toString())[0];

console.log(`API ${BASE}  store "${SLUG}"  ${RUNS} runs\n`);
await bench('GET /books (all)', `${pub}/books`);
await bench('GET /books?limit=16', `${pub}/books?limit=16`);
await bench('GET /books/:id', `${pub}/books/${one.id}`);
await bench('GET /books/search', `${pub}/books/search?q=${encodeURIComponent('صحيح البخاري')}`);
await bench('GET /books/search (miss)', `${pub}/books/search?q=${encodeURIComponent('zzqqxx')}`);
await bench('GET /books/autocomplete', `${pub}/books/autocomplete?q=${encodeURIComponent('تفسير')}`);
await bench('GET /books/suggestions', `${pub}/books/suggestions?q=${encodeURIComponent('فتح')}`);
await bench('GET /books/:id/recommend', `${pub}/books/${one.id}/recommendations`);
await bench('GET /fields', `${pub}/fields`);

if (TOKEN) {
  const H = { authorization: `Bearer ${TOKEN}` };
  await bench('ADMIN /books page 1', `${api}/admin/books?page=1&pageSize=25`, H);
  await bench('ADMIN /books search', `${api}/admin/books?search=${encodeURIComponent('شرح')}`, H);
  await bench('ADMIN /inventory', `${api}/admin/inventory`, H);
  await bench('ADMIN /stats/overview', `${api}/admin/stats/overview?days=30`, H);
  await bench('ADMIN /catalog/authors', `${api}/admin/catalog/authors`, H);
  await bench('ADMIN /orders', `${api}/admin/orders`, H);
}
