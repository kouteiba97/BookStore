import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'quick_add.dart';

class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});
  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  String _search = '';
  Timer? _debounce;
  late Future<({List<AdminBook> books, int total})> _data = Api.books();

  void _reload() => setState(() => _data = Api.books(search: _search));

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            decoration: const InputDecoration(hintText: 'ابحث في الكتب...', prefixIcon: Icon(Icons.search, size: 20)),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 350), () {
                _search = v.trim();
                _reload();
              });
            },
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () async => _reload(),
            child: FutureBuilder<({List<AdminBook> books, int total})>(
              future: _data,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
                if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
                final books = snap.data!.books;
                if (books.isEmpty) return const EmptyView('لا توجد كتب — أضف أول كتاب');
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  itemCount: books.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final b = books[i];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        onTap: () async {
                          await Navigator.of(context)
                              .push(MaterialPageRoute(builder: (_) => QuickAddScreen(existing: b)));
                          _reload();
                        },
                        leading: CoverThumb(imageUrl: b.imageUrl, size: 42),
                        title: Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        subtitle: Text(
                          [
                            if (b.category != null) b.category!.name,
                            if (b.author != null) b.author!.name,
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.5, color: AppColors.mutedForeground),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(money(b.price),
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: AppColors.primary)),
                            const SizedBox(height: 4),
                            StatusChip(b.inventory?.status ?? 'on_request', labels: inventoryStatusLabels),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
