import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

/// Academic taxonomy admin — fields → years → subjects tree with CRUD.
class AcademicScreen extends StatefulWidget {
  const AcademicScreen({super.key});
  @override
  State<AcademicScreen> createState() => _AcademicScreenState();
}

class _AcademicScreenState extends State<AcademicScreen> {
  late Future<List<AcademicField>> _tree = Api.academicTree();

  void _reload() => setState(() => _tree = Api.academicTree());

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
      _reload();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الأكاديمي')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        icon: const Icon(Icons.add),
        label: const Text('تخصص جديد'),
        onPressed: () async {
          final name = await promptName(context, 'إضافة تخصص');
          if (name != null) _run(() => Api.createField(name));
        },
      ),
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: () async => _reload(),
        child: FutureBuilder<List<AcademicField>>(
          future: _tree,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
            if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
            final fields = snap.data!;
            if (fields.isEmpty) return const EmptyView('لا توجد تخصصات بعد');
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
              itemCount: fields.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _fieldCard(fields[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _fieldCard(AcademicField field) {
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        shape: const Border(),
        title: Text(field.name, style: heading(size: 17)),
        subtitle: Text('${field.years.length} سنة',
            style: const TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
        trailing: _rowActions(
          onAdd: () async {
            final name = await promptName(context, 'إضافة سنة إلى «${field.name}»');
            if (name != null) _run(() => Api.createYear(field.id, name));
          },
          onEdit: () async {
            final name = await promptName(context, 'تعديل التخصص', initial: field.name);
            if (name != null) _run(() => Api.updateField(field.id, name));
          },
          onDelete: () async {
            if (await confirmDialog(context, 'حذف «${field.name}»؟')) _run(() => Api.deleteField(field.id));
          },
        ),
        children: [
          for (final year in field.years)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 12),
              child: ExpansionTile(
                shape: const Border(),
                dense: true,
                title: Text(year.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                subtitle: Text('${year.subjects.length} مادة',
                    style: const TextStyle(fontSize: 11, color: AppColors.mutedForeground)),
                trailing: _rowActions(
                  onAdd: () async {
                    final name = await promptName(context, 'إضافة مادة إلى «${year.name}»');
                    if (name != null) _run(() => Api.createSubject(year.id, name));
                  },
                  onEdit: () async {
                    final name = await promptName(context, 'تعديل السنة', initial: year.name);
                    if (name != null) _run(() => Api.updateYear(year.id, name));
                  },
                  onDelete: () async {
                    if (await confirmDialog(context, 'حذف «${year.name}»؟')) _run(() => Api.deleteYear(year.id));
                  },
                ),
                children: [
                  for (final subject in year.subjects)
                    ListTile(
                      dense: true,
                      contentPadding: const EdgeInsetsDirectional.only(start: 32, end: 12),
                      title: Text(subject.name, style: const TextStyle(fontSize: 13)),
                      subtitle: Text('${subject.booksCount} كتاب',
                          style: const TextStyle(fontSize: 10.5, color: AppColors.mutedForeground)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.mutedForeground),
                            onPressed: () async {
                              final name = await promptName(context, 'تعديل المادة', initial: subject.name);
                              if (name != null) _run(() => Api.updateSubject(subject.id, name));
                            },
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(Icons.delete_outline, size: 18, color: AppColors.destructive),
                            onPressed: () async {
                              if (await confirmDialog(context, 'حذف «${subject.name}»؟')) {
                                _run(() => Api.deleteSubject(subject.id));
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _rowActions({required VoidCallback onAdd, required VoidCallback onEdit, required VoidCallback onDelete}) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert, size: 20, color: AppColors.mutedForeground),
      onSelected: (v) => switch (v) { 'add' => onAdd(), 'edit' => onEdit(), _ => onDelete() },
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'add', child: Text('إضافة عنصر فرعي')),
        const PopupMenuItem(value: 'edit', child: Text('تعديل')),
        const PopupMenuItem(value: 'delete', child: Text('حذف', style: TextStyle(color: AppColors.destructive))),
      ],
    );
  }
}
