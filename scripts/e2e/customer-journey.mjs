#!/usr/bin/env node
/**
 * End-to-end check of the customer journey against a LOCAL API:
 * checkout → tracking → admin confirms (stock moves) → shipped → tracking,
 * plus the cart quote and (when the account routes exist) customer accounts.
 *
 *   node --env-file=.env scripts/e2e/customer-journey.mjs          # run + clean up
 *   KEEP=1 node --env-file=.env scripts/e2e/customer-journey.mjs   # keep demo books for a browser check
 *
 * Creates its own books (category «اختبار آلي») and removes everything it made
 * at the end. Refuses to run against anything but localhost.
 */

const API = (process.env.E2E_API ?? 'http://localhost:3000').replace(/\/$/, '');
const SLUG = process.env.STORE_SLUG ?? 'elbayan';
const KEEP = process.env.KEEP === '1';

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) {
  console.error(`Refusing to run against ${API}: local API only.`);
  process.exit(2);
}

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures++;
};

async function call(method, path, { body, token } = {}, retried = false) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // The API rate-limits public writes; wait out the window once instead of failing.
  if (res.status === 429 && !retried) {
    console.log('  … rate limit reached, waiting 61 s');
    await new Promise((r) => setTimeout(r, 61_000));
    return call(method, path, { body, token }, true);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

const customer = {
  firstName: 'اختبار',
  lastName: 'آلي',
  phone: '0555 12 34 56',
  wilaya: 'قسنطينة',
  address: 'حي الاختبار، شارع 1، رقم 2',
};

async function main() {
  // ── Admin login (password from .env, never printed) ──
  const login = await call('POST', '/admin/auth/login', { body: { password: process.env.ADMIN_PASSWORD } });
  ok(login.status === 201 && login.data?.token, 'admin login');
  const admin = login.data.token;

  // ── Fixture books ──
  const made = [];
  for (const [title, price, stock] of [
    ['كتاب اختبار مسعّر', 1500, 5],
    ['كتاب اختبار بلا سعر', null, 3],
  ]) {
    const r = await call('POST', '/admin/books', {
      token: admin,
      body: { title, price, categoryName: 'اختبار آلي', inventory: { status: 'available', stock } },
    });
    ok(r.status === 201, `create fixture book «${title}»`);
    made.push(r.data);
  }
  const [priced, unpriced] = made;

  const created = { orders: [], customers: [] };
  try {
    // ── Quote ──
    const quote = await call('POST', `/${SLUG}/orders/quote`, { body: { bookIds: [priced.id, unpriced.id, 'nope'] } });
    ok(quote.status === 200 && quote.data.books.length === 2, 'quote returns only existing books');
    ok(!JSON.stringify(quote.data).includes('costPrice'), 'quote never exposes costPrice');

    // ── Validation ──
    const bad = await call('POST', `/${SLUG}/orders`, { body: { ...customer, phone: '123', items: [{ bookId: priced.id, quantity: 1 }] } });
    ok(bad.status === 400 && JSON.stringify(bad.data).includes('رقم الهاتف غير صحيح'), 'bad phone → 400 in Arabic');
    const tooMany = await call('POST', `/${SLUG}/orders`, { body: { ...customer, items: [{ bookId: priced.id, quantity: 99 }] } });
    ok(tooMany.status === 400, 'quantity over the cap → 400');
    const bot = await call('POST', `/${SLUG}/orders`, { body: { ...customer, website: 'x', items: [{ bookId: priced.id, quantity: 1 }] } });
    ok(bot.status === 400, 'honeypot filled → 400');

    // ── Checkout (two lines, one unpriced; a client price is ignored) ──
    const placed = await call('POST', `/${SLUG}/orders`, {
      body: {
        ...customer,
        note: 'الطبعة الحديثة من فضلكم',
        items: [
          { bookId: priced.id, quantity: 2, unitPrice: 1 },
          { bookId: unpriced.id, quantity: 1 },
        ],
      },
    });
    ok(placed.status === 201, 'checkout → 201');
    const order = placed.data;
    created.orders.push(order.reference);
    ok(/^[A-Z]{1,4}-[1-9]\d{5}$/.test(order.reference), `reference format (${order.reference})`);
    ok(order.subtotal === 3000, 'server-side prices (2 × 1500, client price ignored)');
    ok(order.hasUnpricedItems === true, 'flags unpriced books');
    ok(order.status.step === 0 && order.status.status === 'pending', 'starts pending');
    ok(!order.whatsappUrl || decodeURIComponent(order.whatsappUrl).includes(order.reference), 'WhatsApp message carries the reference');
    ok(order.phone === '0555123456', 'phone normalised');

    // ── Tracking ──
    const wrong = await call('GET', `/${SLUG}/orders/track?ref=${order.reference}&phone=0666000000`);
    ok(wrong.status === 404, 'track with wrong phone → 404');
    const right = await call('GET', `/${SLUG}/orders/track?ref=${encodeURIComponent(order.reference.toLowerCase().replace('-', ' '))}&phone=${encodeURIComponent('+213555123456')}`);
    ok(right.status === 200 && right.data.status.status === 'pending', 'track with typed variants → pending');
    const leaked = ['address', 'notes', 'unitCost', 'lastName', 'phone', 'invoiceNumber'].filter((k) => k in (right.data ?? {}));
    ok(leaked.length === 0, `tracking exposes no private fields ${leaked.length ? leaked : ''}`);

    // ── Admin works the order ──
    const list = await call('GET', `/admin/orders?search=${order.reference}`, { token: admin });
    const row = list.data?.orders?.[0];
    ok(row?.reference === order.reference && row.status === 'pending' && row.channel === 'online', 'admin finds it by reference');
    ok(row?.notes?.includes('الطبعة الحديثة'), "customer's note reaches the admin");

    const stockBefore = (await call('GET', `/admin/books/${priced.id}`, { token: admin })).data?.inventory?.stock;
    const conf = await call('PATCH', `/admin/orders/${row.id}/status`, { token: admin, body: { status: 'confirmed' } });
    ok(conf.status === 200, 'admin confirms');
    const stockAfter = (await call('GET', `/admin/books/${priced.id}`, { token: admin })).data?.inventory?.stock;
    ok(stockBefore - stockAfter === 2, `stock moves on confirm (${stockBefore} → ${stockAfter})`);

    const t1 = await call('GET', `/${SLUG}/orders/track?ref=${order.reference}&phone=0555123456`);
    ok(t1.data?.status.step === 1, 'tracking shows confirmed');

    const ship = await call('PATCH', `/admin/orders/${row.id}/shipping`, { token: admin, body: { carrier: 'Yalidine', trackingNumber: 'YAL-123' } });
    ok(ship.status === 200 && ship.data.trackingNumber === 'YAL-123', 'admin saves carrier + tracking number');
    await call('PATCH', `/admin/orders/${row.id}/status`, { token: admin, body: { status: 'shipped' } });
    const t2 = await call('GET', `/${SLUG}/orders/track?ref=${order.reference}&phone=0555123456`);
    ok(t2.data?.status.step === 2 && t2.data.carrier === 'Yalidine' && t2.data.trackingNumber === 'YAL-123', 'tracking shows shipped + tracking number');

    // ── Customer accounts (phase 3; skipped when the routes are absent) ──
    const probe = await call('GET', `/${SLUG}/account/me`);
    if (probe.status === 404 && !String(probe.data?.message ?? '').includes('Unauthorized')) {
      console.log('· account routes not present — skipping account checks');
    } else {
      await accountChecks({ admin, priced, created });
    }
  } finally {
    if (KEEP) {
      console.log('KEEP=1 — leaving fixture books and orders in place.');
    } else {
      // Cancel (returns stock) and delete every order we made, then the books.
      for (const ref of created.orders) {
        const r = await call('GET', `/admin/orders?search=${ref}`, { token: admin });
        for (const o of r.data?.orders ?? []) {
          if (o.status !== 'cancelled') await call('POST', `/admin/orders/${o.id}/cancel`, { token: admin });
          await call('DELETE', `/admin/orders/${o.id}`, { token: admin });
        }
      }
      for (const c of created.customers) await call('DELETE', `/admin/customers/${c}`, { token: admin });
      for (const b of made) await call('DELETE', `/admin/books/${b.id}`, { token: admin });
      console.log('cleaned up fixtures');
    }
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

async function accountChecks({ admin, priced, created }) {
  const phone = `07${String(Date.now()).slice(-8)}`;
  const reg = await call('POST', `/${SLUG}/account/register`, {
    body: { ...customer, phone, password: 'kalimat-sirr-9' },
  });
  ok(reg.status === 201 && reg.data?.token, 'register');
  const token = reg.data.token;
  created.customers.push(reg.data.customer?.id);

  const dup = await call('POST', `/${SLUG}/account/register`, { body: { ...customer, phone, password: 'another-pass-1' } });
  ok(dup.status === 409, 'second account on the same phone → 409');

  const badLogin = await call('POST', `/${SLUG}/account/login`, { body: { phone, password: 'wrong-password' } });
  ok(badLogin.status === 401, 'wrong password → 401');
  const goodLogin = await call('POST', `/${SLUG}/account/login`, { body: { phone: `+213${phone.slice(1)}`, password: 'kalimat-sirr-9' } });
  ok(goodLogin.status === 201 && goodLogin.data?.token, 'login with +213 form of the number');

  // Token separation, both ways.
  const adminWithCustomer = await call('GET', '/admin/orders', { token });
  ok(adminWithCustomer.status === 401, 'customer token refused on admin routes');
  const customerWithAdmin = await call('GET', `/${SLUG}/account/me`, { token: admin });
  ok(customerWithAdmin.status === 401, 'admin token refused on account routes');

  const me = await call('GET', `/${SLUG}/account/me`, { token });
  ok(me.status === 200 && me.data.phone === phone && !('passwordHash' in me.data), 'profile, no password hash');

  const upd = await call('PATCH', `/${SLUG}/account/me`, { token, body: { wilaya: 'وهران', address: 'حي العقيد لطفي، عمارة 5' } });
  ok(upd.status === 200 && upd.data.wilaya === 'وهران', 'update saved address');

  // An order placed while logged in is linked; a guest one with the same phone is not.
  const mine = await call('POST', `/${SLUG}/orders`, { token, body: { ...customer, phone, items: [{ bookId: priced.id, quantity: 1 }] } });
  ok(mine.status === 201, 'order while logged in');
  created.orders.push(mine.data.reference);
  const guest = await call('POST', `/${SLUG}/orders`, { body: { ...customer, phone, items: [{ bookId: priced.id, quantity: 1 }] } });
  created.orders.push(guest.data.reference);
  const myOrders = await call('GET', `/${SLUG}/account/orders`, { token });
  const refs = (myOrders.data?.orders ?? []).map((o) => o.reference);
  ok(refs.includes(mine.data.reference), '«طلباتي» lists the logged-in order');
  ok(!refs.includes(guest.data.reference), 'guest order with the same phone is NOT attached');

  // Admin: customers list + reset link → new password works, old one and old token stop.
  const custs = await call('GET', `/admin/customers?search=${phone}`, { token: admin });
  const c = custs.data?.customers?.[0];
  ok(c?.phone === phone && c.ordersCount === 1, 'admin customers list with order count');
  const link = await call('POST', `/admin/customers/${c.id}/reset-link`, { token: admin });
  ok(link.status === 201 && /token=/.test(link.data?.url ?? ''), 'admin reset link');
  const resetToken = new URL(link.data.url).searchParams.get('token');
  const reset = await call('POST', `/${SLUG}/account/password/reset`, { body: { token: resetToken, password: 'new-secret-77' } });
  ok(reset.status === 201 && reset.data?.token, 'reset password with the link');
  const again = await call('POST', `/${SLUG}/account/password/reset`, { body: { token: resetToken, password: 'third-secret-88' } });
  ok(again.status === 400, 'reset link works only once');
  const oldToken = await call('GET', `/${SLUG}/account/me`, { token });
  ok(oldToken.status === 401, 'old session ends after a reset');
  const newLogin = await call('POST', `/${SLUG}/account/login`, { body: { phone, password: 'new-secret-77' } });
  ok(newLogin.status === 201, 'login with the new password');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
