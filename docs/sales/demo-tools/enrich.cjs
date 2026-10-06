const { Client } = require('pg');
const authors = {
  'تفسير الطبري': 'محمد بن جرير الطبري', 'تفسير القرطبي': 'أبو عبد الله القرطبي',
  'تفسير التحرير والتنوير': 'محمد الطاهر ابن عاشور', 'الكشاف': 'جار الله الزمخشري',
  'الاتقان في علوم القرآن': 'جلال الدين السيوطي', 'الدر المنثور في التفسير بالمأثور': 'جلال الدين السيوطي',
  'البرهان في علوم القرآن': 'بدر الدين الزركشي', 'زاد المسير': 'ابن الجوزي',
  'تفسير البيضاوي': 'ناصر الدين البيضاوي', 'التفسير الكبير': 'فخر الدين الرازي',
  'التفسير والمفسرون': 'محمد حسين الذهبي',
};
(async () => {
  const c = new Client({ host: '127.0.0.1', port: 5433, user: 'postgres', password: 'postgres', database: 'postgres' });
  await c.connect();
  for (const [title, name] of Object.entries(authors)) {
    const a = await c.query('insert into "Author"(id,name) values (gen_random_uuid(),$1) on conflict (name) do update set name=excluded.name returning id', [name]);
    const b = await c.query('select id from "Book" where title=$1', [title]);
    for (const r of b.rows) await c.query('insert into "BookAuthor"("bookId","authorId",position) values ($1,$2,0) on conflict do nothing', [r.id, a.rows[0].id]);
  }
  await c.query(`update "Book" set description=$1, notes=$2, year=1984 where title='تفسير التحرير والتنوير'`, [
    'تفسير شامل للقرآن الكريم للعلامة محمد الطاهر ابن عاشور، يعنى بالبلاغة واللغة ومقاصد الآيات، ويُعدّ من أهم التفاسير المعاصرة.',
    'نسخة تجريبية للعرض: عدة مجلدات، تجليد فني.',
  ]);
  console.log('enriched');
  await c.end();
})().catch((e) => console.log('ERR', e.message));
