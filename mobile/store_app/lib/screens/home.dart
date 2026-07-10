import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../sheets.dart';
import '../theme.dart';
import '../widgets.dart';
import 'book_detail.dart';
import 'search.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Book>> _books;

  @override
  void initState() {
    super.initState();
    _books = Api.fetchBooks();
  }

  void _reload() => setState(() => _books = Api.fetchBooks());

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: () async => _reload(),
      child: FutureBuilder<List<Book>>(
        future: _books,
        builder: (context, snap) {
          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _Hero(onSearchTap: () {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen(standalone: true)));
              })),
              if (snap.connectionState == ConnectionState.waiting)
                const SliverToBoxAdapter(child: LoadingView())
              else if (snap.hasError)
                SliverToBoxAdapter(child: ErrorView(error: snap.error!, onRetry: _reload))
              else ...[
                ..._categories(snap.data!),
                ..._latest(snap.data!),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _categories(List<Book> books) {
    final seen = <String>{};
    final cats = <Category>[];
    for (final b in books) {
      final c = b.category;
      if (c != null && seen.add(c.id)) cats.add(c);
    }
    if (cats.isEmpty) return [];
    return [
      SliverToBoxAdapter(
        child: SectionTitle('تصفح حسب التصنيف',
            trailing: Text('${cats.length} تصنيف', style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
      ),
      SliverToBoxAdapter(
        child: SizedBox(
          height: 108,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: cats.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) => _CategoryTile(
              category: cats[i],
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => SearchScreen(standalone: true, initialQuery: cats[i].name))),
            ),
          ),
        ),
      ),
    ];
  }

  List<Widget> _latest(List<Book> books) {
    return [
      SliverToBoxAdapter(
        child: SectionTitle('أحدث الإضافات',
            trailing: const Text('جديدنا في المكتبة',
                style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
      ),
      if (books.isEmpty)
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.symmetric(vertical: 44),
            decoration: BoxDecoration(
              color: AppColors.card.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1.4),
            ),
            child: const Center(
                child: Text('لا توجد كتب لعرضها حاليًا',
                    style: TextStyle(fontSize: 13, color: AppColors.mutedForeground))),
          ),
        )
      else
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.62),
            delegate: SliverChildBuilderDelegate(
              (context, i) => BookCard(
                book: books[i],
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: books[i].id, initial: books[i]))),
              ),
              childCount: books.length,
            ),
          ),
        ),
      const SliverToBoxAdapter(child: _RequestCta()),
    ];
  }
}

/// "Didn't find the book you're looking for?" banner — mirrors the web home CTA.
class _RequestCta extends StatelessWidget {
  const _RequestCta();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFF2C5443), Color(0xFF1F3A2E), Color(0xFF122318)],
        ),
      ),
      child: Column(
        children: [
          Text('لم تجد الكتاب الذي تبحث عنه؟',
              textAlign: TextAlign.center,
              style: heading(size: 22, color: const Color(0xFFE8C574))),
          const SizedBox(height: 6),
          const Text('أرسل لنا طلبك وسنوفّره لك في أقرب وقت',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFFCBC5B4))),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDCA54C),
              foregroundColor: const Color(0xFF2B2113),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            onPressed: () => showRequestSheet(context),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('اطلب كتابك الآن'),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  final VoidCallback onSearchTap;
  const _Hero({required this.onSearchTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: const [BoxShadow(color: Color(0x144A4136), blurRadius: 24, offset: Offset(0, 8))],
      ),
      child: Column(
        children: [
          const BrandLogo(size: 96),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.goldLight.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
            ),
            child: const Text('مكتبة شرعية متخصصة',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF8A6620))),
          ),
          const SizedBox(height: 12),
          Text('اكتشف كنوز العلم الشرعي', textAlign: TextAlign.center, style: heading(size: 28)),
          const SizedBox(height: 8),
          const Text(
            'آلاف الكتب في الفقه، الحديث، التفسير، العقيدة واللغة.\nابحث، تصفّح، أو اطلب الكتاب الذي تحتاجه.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.mutedForeground, height: 1.7),
          ),
          const SizedBox(height: 18),
          // Fake search box — tapping opens the real search screen.
          InkWell(
            onTap: onSearchTap,
            borderRadius: BorderRadius.circular(999),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.border),
              ),
              child: const Row(
                children: [
                  Expanded(
                      child: Text('ابحث عن كتاب، مؤلف، أو تصنيف...',
                          style: TextStyle(color: AppColors.mutedForeground, fontSize: 13))),
                  Icon(Icons.search, color: AppColors.mutedForeground, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  final Category category;
  final VoidCallback onTap;
  const _CategoryTile({required this.category, required this.onTap});

  static const _icons = <String, String>{
    'فقه': '⚖️',
    'حديث': '📜',
    'قرآن': '📖',
    'عقيدة': '🕌',
    'تفسير': '🌙',
    'لغة': '✒️',
    'سيرة': '🕋',
    'تاريخ': '🏛️',
  };

  @override
  Widget build(BuildContext context) {
    final emoji = _icons.entries
        .firstWhere((e) => category.name.contains(e.key), orElse: () => const MapEntry('', '📚'))
        .value;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 104,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: AppColors.goldLight.withValues(alpha: 0.5), shape: BoxShape.circle),
              child: Center(child: Text(emoji, style: const TextStyle(fontSize: 20))),
            ),
            const SizedBox(height: 8),
            Text(category.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
