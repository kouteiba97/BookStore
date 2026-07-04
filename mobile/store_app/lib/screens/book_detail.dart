import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../sheets.dart';
import '../theme.dart';
import '../widgets.dart';

class BookDetailScreen extends StatefulWidget {
  final String bookId;
  final Book? initial;
  const BookDetailScreen({super.key, required this.bookId, this.initial});

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  late Future<Book> _book;
  late Future<List<Book>> _recommendations;

  @override
  void initState() {
    super.initState();
    _book = Api.fetchBook(widget.bookId);
    _recommendations = Api.fetchRecommendations(widget.bookId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل الكتاب')),
      body: FutureBuilder<Book>(
        future: _book,
        initialData: widget.initial,
        builder: (context, snap) {
          final book = snap.data;
          if (book == null) {
            if (snap.hasError) {
              return ErrorView(error: snap.error!, onRetry: () => setState(() => _book = Api.fetchBook(widget.bookId)));
            }
            return const LoadingView();
          }
          return _content(book);
        },
      ),
    );
  }

  Widget _content(Book book) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: SizedBox(
            width: 190,
            child: AspectRatio(
              aspectRatio: 3 / 4,
              child: BookCover(imageUrl: book.imageUrl, radius: BorderRadius.circular(16)),
            ),
          ),
        ),
        const SizedBox(height: 18),
        Text(book.title, textAlign: TextAlign.center, style: heading(size: 24)),
        if (book.author != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(book.author!.name,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.mutedForeground, fontSize: 14)),
          ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AvailabilityChip(inventory: book.inventory),
            if (book.price != null) ...[
              const SizedBox(width: 10),
              Text(priceLabel(book.price),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary)),
            ],
          ],
        ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                if (book.category != null) _row('التصنيف', book.category!.name),
                if (book.publisher != null) _row('دار النشر', book.publisher!.name),
                if (book.year != null) _row('سنة النشر', '${book.year}'),
              ],
            ),
          ),
        ),
        if (book.description != null && book.description!.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('نبذة عن الكتاب', style: heading(size: 17)),
                  const SizedBox(height: 6),
                  Text(book.description!, style: const TextStyle(height: 1.8, fontSize: 13.5)),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        ElevatedButton.icon(
          onPressed: () => showOrderSheet(context, book),
          icon: const Icon(Icons.chat_rounded, size: 20),
          label: const Text('اطلب عبر واتساب'),
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => showRequestSheet(context, bookId: book.id, bookName: book.title),
          icon: const Icon(Icons.bookmark_add_outlined, size: 20),
          label: const Text('اطلب توفير هذا الكتاب'),
        ),
        _recommendationsSection(),
      ],
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          children: [
            SizedBox(
                width: 90,
                child: Text(label, style: const TextStyle(color: AppColors.mutedForeground, fontSize: 13))),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
          ],
        ),
      );

  Widget _recommendationsSection() {
    return FutureBuilder<List<Book>>(
      future: _recommendations,
      builder: (context, snap) {
        final books = snap.data ?? [];
        if (books.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 10),
            Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('كتب مشابهة', style: heading(size: 19))),
            SizedBox(
              height: 250,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: books.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, i) => SizedBox(
                  width: 150,
                  child: BookCard(
                    book: books[i],
                    onTap: () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: books[i].id, initial: books[i]))),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
