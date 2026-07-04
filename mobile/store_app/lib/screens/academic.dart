import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'book_detail.dart';

/// Academic browse: fields → years → subjects → books.
/// Mirrors frontend/src/pages/academic/*.

class AcademicFieldsScreen extends StatefulWidget {
  const AcademicFieldsScreen({super.key});
  @override
  State<AcademicFieldsScreen> createState() => _AcademicFieldsScreenState();
}

class _AcademicFieldsScreenState extends State<AcademicFieldsScreen> {
  late Future<List<Field>> _fields = Api.fetchFields();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('التخصصات الأكاديمية'),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text('اختر تخصصك ثم السنة والمادة للوصول إلى الكتب المقررة',
                style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: FutureBuilder<List<Field>>(
              future: _fields,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
                if (snap.hasError) {
                  return ErrorView(error: snap.error!, onRetry: () => setState(() => _fields = Api.fetchFields()));
                }
                final fields = snap.data!;
                if (fields.isEmpty) return const EmptyView('لا توجد تخصصات بعد');
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: fields.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => _NavTile(
                    icon: Icons.account_balance_rounded,
                    title: fields[i].name,
                    onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => AcademicYearsScreen(field: fields[i]))),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class AcademicYearsScreen extends StatefulWidget {
  final Field field;
  const AcademicYearsScreen({super.key, required this.field});
  @override
  State<AcademicYearsScreen> createState() => _AcademicYearsScreenState();
}

class _AcademicYearsScreenState extends State<AcademicYearsScreen> {
  late Future<List<AcademicYear>> _years = Api.fetchYears(widget.field.id);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.field.name)),
      body: FutureBuilder<List<AcademicYear>>(
        future: _years,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) {
            return ErrorView(error: snap.error!, onRetry: () => setState(() => _years = Api.fetchYears(widget.field.id)));
          }
          final years = snap.data!;
          if (years.isEmpty) return const EmptyView('لا توجد سنوات لهذا التخصص');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: years.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _NavTile(
              icon: Icons.calendar_month_rounded,
              title: years[i].name,
              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => AcademicSubjectsScreen(field: widget.field, year: years[i]))),
            ),
          );
        },
      ),
    );
  }
}

class AcademicSubjectsScreen extends StatefulWidget {
  final Field field;
  final AcademicYear year;
  const AcademicSubjectsScreen({super.key, required this.field, required this.year});
  @override
  State<AcademicSubjectsScreen> createState() => _AcademicSubjectsScreenState();
}

class _AcademicSubjectsScreenState extends State<AcademicSubjectsScreen> {
  late Future<List<Subject>> _subjects = Api.fetchSubjects(widget.year.id);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${widget.field.name} — ${widget.year.name}')),
      body: FutureBuilder<List<Subject>>(
        future: _subjects,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) {
            return ErrorView(
                error: snap.error!, onRetry: () => setState(() => _subjects = Api.fetchSubjects(widget.year.id)));
          }
          final subjects = snap.data!;
          if (subjects.isEmpty) return const EmptyView('لا توجد مواد لهذه السنة');
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: subjects.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _NavTile(
              icon: Icons.menu_book_rounded,
              title: subjects[i].name,
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => SubjectBooksScreen(subject: subjects[i]))),
            ),
          );
        },
      ),
    );
  }
}

class SubjectBooksScreen extends StatefulWidget {
  final Subject subject;
  const SubjectBooksScreen({super.key, required this.subject});
  @override
  State<SubjectBooksScreen> createState() => _SubjectBooksScreenState();
}

class _SubjectBooksScreenState extends State<SubjectBooksScreen> {
  late Future<List<Book>> _books = Api.fetchSubjectBooks(widget.subject.id);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.subject.name)),
      body: FutureBuilder<List<Book>>(
        future: _books,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) {
            return ErrorView(
                error: snap.error!, onRetry: () => setState(() => _books = Api.fetchSubjectBooks(widget.subject.id)));
          }
          final books = snap.data!;
          if (books.isEmpty) return const EmptyView('لا توجد كتب لهذه المادة بعد');
          return GridView.builder(
            padding: const EdgeInsets.all(16),
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
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  const _NavTile({required this.icon, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(color: AppColors.goldLight.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: const Color(0xFF8A6620), size: 22),
        ),
        title: Text(title, style: heading(size: 17, weight: FontWeight.w700)),
        trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.mutedForeground),
      ),
    );
  }
}
