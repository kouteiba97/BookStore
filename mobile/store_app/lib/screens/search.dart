import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'book_detail.dart';

class SearchScreen extends StatefulWidget {
  /// standalone=true when pushed on top of the shell (from home hero/category).
  final bool standalone;
  final String? initialQuery;
  const SearchScreen({super.key, this.standalone = false, this.initialQuery});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  Future<List<Book>>? _results;
  String _query = '';

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null) {
      _controller.text = widget.initialQuery!;
      _run(widget.initialQuery!);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _run(value));
  }

  void _run(String value) {
    final q = value.trim();
    setState(() {
      _query = q;
      _results = q.isEmpty ? null : Api.searchBooks(q);
    });
  }

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _controller,
            autofocus: widget.standalone && widget.initialQuery == null,
            textInputAction: TextInputAction.search,
            onChanged: _onChanged,
            onSubmitted: _run,
            decoration: InputDecoration(
              hintText: 'ابحث عن كتاب، مؤلف، أو تصنيف...',
              prefixIcon: const Icon(Icons.search, color: AppColors.mutedForeground),
              suffixIcon: _controller.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _controller.clear();
                        _run('');
                      }),
            ),
          ),
        ),
        Expanded(child: _resultsView()),
      ],
    );

    if (!widget.standalone) return SafeArea(child: body);
    return Scaffold(appBar: AppBar(title: const Text('البحث')), body: body);
  }

  Widget _resultsView() {
    if (_results == null) {
      return const EmptyView('اكتب للبحث في المكتبة');
    }
    return FutureBuilder<List<Book>>(
      future: _results,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
        if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => _run(_query));
        final books = snap.data!;
        if (books.isEmpty) return EmptyView('لا توجد نتائج لـ «$_query»');
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.62),
          itemCount: books.length,
          itemBuilder: (context, i) => BookCard(
            book: books[i],
            onTap: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => BookDetailScreen(bookId: books[i].id, initial: books[i]))),
          ),
        );
      },
    );
  }
}
