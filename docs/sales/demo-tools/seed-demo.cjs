// Local DEMO data for screenshots only. Real public catalogue (titles + covers)
// from the live store's public API, plus clearly fictional prices/stock/orders.
const { PrismaClient } = require(require.resolve('@prisma/client', { paths: ['C:/Users/ii/Desktop/BookStore'] }));
const prisma = new PrismaClient();
const API = 'https://bookstore-api-uzrj.onrender.com/api/v1/elbayan';
const get = async (p) => { const r = await fetch(API + p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const daysAgo = (d, h = 10) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, Math.floor(rnd() * 60), 0, 0); return t; };

async function main() {
  const store = await prisma.store.create({ data: { name: 'مكتبة البيان', slug: 'elbayan' } });

  // ── Catalogue: real titles and covers, demo prices/stock ──
  const cats = await get('/categories');
  const catId = {};
  for (const c of cats) catId[c.id] = (await prisma.category.create({ data: { name: c.name } })).id;

  const list = await get('/books');
  const seen = new Set();
  const books = [];
  const prices = [900, 1200, 1500, 1800, 2200, 2500, 2800, 3500, 4200];
  for (const b of list.reverse()) {
    if (seen.has(b.titleNormalized || b.title)) continue;
    seen.add(b.titleNormalized || b.title);
    const stockRoll = rnd();
    const status = stockRoll < 0.08 ? 'rare' : stockRoll < 0.16 ? 'on_request' : 'available';
    const stock = status === 'available' ? (stockRoll < 0.3 ? 1 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 14)) : 0;
    const book = await prisma.book.create({
      data: {
        title: b.title,
        titleNormalized: b.titleNormalized,
        description: b.description,
        notes: b.notes,
        price: pick(prices),
        imageUrl: b.imageUrl,
        storeId: store.id,
        categoryId: catId[b.categoryId] ?? Object.values(catId)[0],
        images: { create: (b.images?.length ? b.images : b.imageUrl ? [b.imageUrl] : []).map((url, position) => ({ url, position })) },
        inventory: { create: { storeId: store.id, status, stock } },
        createdAt: daysAgo(Math.floor(rnd() * 40)),
      },
    });
    books.push(book);
  }

  // ── Academic taxonomy: real fields/years, demo subjects + links ──
  const fields = await get('/fields');
  const subjectsByName = {
    'سنة أولى': ['مدخل إلى علوم القرآن', 'التفسير التحليلي'],
    'سنة ثانية': ['مناهج المفسرين', 'أصول التفسير'],
    'سنة ثالثة': ['التفسير الموضوعي', 'إعجاز القرآن'],
    'ماستر': ['قضايا التفسير المعاصر'],
  };
  let tafsirField, tafsirSubjects = [], tafsirYears = [];
  for (const f of fields) {
    const field = await prisma.field.create({ data: { name: f.name } });
    const years = await get(`/fields/${f.id}/years`);
    const order = ['سنة أولى', 'سنة ثانية', 'سنة ثالثة', 'ماستر'];
    years.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    for (const y of years) {
      const year = await prisma.academicYear.create({ data: { name: y.name, fieldId: field.id } });
      if (f.name.includes('التفسير')) {
        tafsirYears.push(year);
        for (const s of subjectsByName[y.name] ?? []) tafsirSubjects.push(await prisma.subject.create({ data: { name: s, yearId: year.id } }));
      }
    }
    if (f.name.includes('التفسير')) tafsirField = field;
  }
  // Link most tafsir books to the speciality, spread across subjects.
  for (const [i, b] of books.entries()) {
    if (i % 4 === 3) continue;
    const s = tafsirSubjects[i % tafsirSubjects.length];
    await prisma.bookOnSubject.create({ data: { bookId: b.id, subjectId: s.id } });
    if (i % 5 === 0) await prisma.bookOnField.create({ data: { bookId: b.id, fieldId: tafsirField.id } });
  }
  // A few books linked to other specialities so their pages are not empty.
  const others = await prisma.field.findMany({ where: { id: { not: tafsirField.id } } });
  for (const [j, f] of others.entries()) {
    for (let k = 0; k < 3; k++) {
      const b = books[(j * 3 + k * 7) % books.length];
      await prisma.bookOnField.upsert({ where: { bookId_fieldId: { bookId: b.id, fieldId: f.id } }, update: {}, create: { bookId: b.id, fieldId: f.id } });
    }
  }

  // ── Fictional customers, orders and requests (demo only) ──
  const first = ['ياسين', 'أمينة', 'عبد الرحمن', 'سارة', 'محمد', 'خديجة', 'إسماعيل', 'نور الهدى', 'بلال', 'مريم', 'أيوب', 'فاطمة الزهراء', 'حمزة', 'إيمان'];
  const last = ['ب.', 'م.', 'ع.', 'ق.', 'ح.', 'س.', 'ر.', 'ت.'];
  const wilayas = ['الجزائر', 'وهران', 'قسنطينة', 'سطيف', 'البليدة', 'تلمسان', 'بجاية', 'باتنة', 'عنابة', 'تيزي وزو', 'بومرداس', 'الجلفة', 'ورقلة'];
  const statuses = [...Array(10).fill('delivered'), ...Array(5).fill('shipped'), ...Array(6).fill('confirmed'), ...Array(5).fill('pending'), 'cancelled', 'cancelled'];
  let n = 0;
  const customer = () => ({ firstName: pick(first), lastName: pick(last), phone: '05500000' + String(10 + (n++ % 90)), wilaya: pick(wilayas), address: 'عنوان تجريبي' });
  const orders = [];
  for (const [i, status] of statuses.entries()) {
    const age = status === 'pending' ? Math.floor(rnd() * 3) : status === 'delivered' ? 6 + Math.floor(rnd() * 24) : Math.floor(rnd() * 10);
    const lines = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => ({ book: pick(books), qty: rnd() < 0.8 ? 1 : 2 }));
    const subtotal = lines.reduce((s, l) => s + Number(l.book.price) * l.qty, 0);
    const shipping = pick([400, 500, 600, 800]);
    const o = await prisma.order.create({
      data: {
        storeId: store.id, ...customer(), status, subtotal, shippingCost: shipping, total: subtotal + shipping,
        createdAt: daysAgo(age, 9 + (i % 10)),
        items: { create: lines.map((l) => ({ bookId: l.book.id, bookTitle: l.book.title, unitPrice: l.book.price, quantity: l.qty })) },
      },
    });
    orders.push(o);
  }
  const reqStatuses = ['pending', 'pending', 'pending', 'pending', 'contacted', 'contacted', 'done', 'done'];
  for (const [i, status] of reqStatuses.entries()) {
    const b = pick(books);
    await prisma.request.create({
      data: {
        storeId: store.id, ...customer(), bookId: b.id, bookName: b.title, status,
        createdAt: daysAgo(i < 4 ? i % 2 : 3 + i, 11 + i),
        ...(status === 'done' && i === 6 ? { convertedOrderId: orders.find((o) => o.status === 'confirmed').id } : {}),
      },
    });
  }
  console.log(`demo: ${books.length} books, ${tafsirSubjects.length} subjects, ${orders.length} orders, ${reqStatuses.length} requests`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
