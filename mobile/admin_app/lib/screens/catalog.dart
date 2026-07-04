import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

const _resources = [
  ('categories', 'التصنيفات'),
  ('authors', 'المؤلفون'),
  ('publishers', 'دور النشر'),
  ('countries', 'البلدان'),
];

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: _resources.length, vsync: this);
  final _futures = <String, Future<List<CatalogItem>>>{};

  @override
  void initState() {
    super.initState();
    for (final (resource, _) in _resources) {
      _futures[resource] = Api.catalog(resource);
    }
  }

  void _reload(String resource) => setState(() => _futures[resource] = Api.catalog(resource));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الفهرس'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primaryForeground,
          unselectedLabelColor: AppColors.primaryForeground.withValues(alpha: 0.6),
          indicatorColor: AppColors.gold,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: [for (final (_, label) in _resources) Tab(text: label)],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [for (final (resource, label) in _resources) _resourceList(resource, label)],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        onPressed: () async {
          final (resource, label) = _resources[_tabs.index];
          final name = await promptName(context, 'إضافة إلى $label');
          if (name == null) return;
          try {
            await Api.createCatalog(resource, name);
            _reload(resource);
          } catch (e) {
            if (context.mounted) showError(context, e);
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _resourceList(String resource, String label) {
    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: () async => _reload(resource),
      child: FutureBuilder<List<CatalogItem>>(
        future: _futures[resource],
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: () => _reload(resource));
          final items = snap.data!;
          if (items.isEmpty) return EmptyView('لا عناصر في $label بعد');
          return ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final item = items[i];
              return Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: Text('${item.booksCount} كتاب',
                      style: const TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 20, color: AppColors.mutedForeground),
                        onPressed: () async {
                          final name = await promptName(context, 'تعديل الاسم', initial: item.name);
                          if (name == null || name == item.name) return;
                          try {
                            await Api.updateCatalog(resource, item.id, name);
                            _reload(resource);
                          } catch (e) {
                            if (context.mounted) showError(context, e);
                          }
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.destructive),
                        onPressed: () async {
                          if (!await confirmDialog(context, 'حذف «${item.name}»؟')) return;
                          try {
                            await Api.deleteCatalog(resource, item.id);
                            _reload(resource);
                          } catch (e) {
                            if (context.mounted) showError(context, e);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
