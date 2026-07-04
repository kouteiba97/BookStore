import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _search = '';
  String? _status;
  bool _lowStock = false;
  Timer? _debounce;
  late Future<List<AdminBook>> _items = Api.inventory();

  void _reload() =>
      setState(() => _items = Api.inventory(search: _search, status: _status, lowStock: _lowStock));

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('المخزون')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              decoration: const InputDecoration(hintText: 'ابحث في المخزون...', prefixIcon: Icon(Icons.search, size: 20)),
              onChanged: (v) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () {
                  _search = v.trim();
                  _reload();
                });
              },
            ),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              scrollDirection: Axis.horizontal,
              children: [
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: 8),
                  child: FilterChip(
                    selected: _lowStock,
                    label: const Text('مخزون منخفض', style: TextStyle(fontSize: 12)),
                    selectedColor: const Color(0xFFF5D9D3),
                    onSelected: (v) {
                      _lowStock = v;
                      _reload();
                    },
                  ),
                ),
                _filterChip(null, 'الكل'),
                for (final s in inventoryStatusLabels.entries) _filterChip(s.key, s.value),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.gold,
              onRefresh: () async => _reload(),
              child: FutureBuilder<List<AdminBook>>(
                future: _items,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
                  if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
                  final items = snap.data!;
                  if (items.isEmpty) return const EmptyView('لا نتائج');
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) => _inventoryTile(items[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String? value, String label) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: FilterChip(
          selected: _status == value,
          label: Text(label, style: const TextStyle(fontSize: 12)),
          selectedColor: AppColors.goldLight,
          onSelected: (_) {
            _status = value;
            _reload();
          },
        ),
      );

  Widget _inventoryTile(AdminBook b) {
    final stock = b.inventory?.stock;
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        onTap: () => _editSheet(b),
        leading: CoverThumb(imageUrl: b.imageUrl, size: 40),
        title: Text(b.title, maxLines: 2, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        subtitle: Text(
          stock == null ? 'الكمية غير محددة' : 'الكمية: $stock',
          style: TextStyle(
              fontSize: 12,
              color: (stock != null && stock <= 2) ? AppColors.destructive : AppColors.mutedForeground,
              fontWeight: (stock != null && stock <= 2) ? FontWeight.w700 : FontWeight.normal),
        ),
        trailing: StatusChip(b.inventory?.status ?? 'on_request', labels: inventoryStatusLabels),
      ),
    );
  }

  void _editSheet(AdminBook b) {
    var status = b.inventory?.status ?? 'available';
    final stockController = TextEditingController(text: b.inventory?.stock?.toString() ?? '');
    var saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.only(
              left: 20, right: 20, top: 20, bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(b.title, textAlign: TextAlign.center, style: heading(size: 17), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                style: SegmentedButton.styleFrom(textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                segments: [
                  for (final e in inventoryStatusLabels.entries) ButtonSegment(value: e.key, label: Text(e.value)),
                ],
                selected: {status},
                onSelectionChanged: (v) => setSheetState(() => status = v.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: stockController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'الكمية (اختياري)'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: saving
                    ? null
                    : () async {
                        setSheetState(() => saving = true);
                        try {
                          await Api.updateInventory(b.id,
                              status: status,
                              stock: stockController.text.trim().isEmpty
                                  ? null
                                  : int.tryParse(stockController.text.trim()));
                          if (sheetContext.mounted) Navigator.pop(sheetContext);
                          _reload();
                        } catch (e) {
                          if (sheetContext.mounted) {
                            setSheetState(() => saving = false);
                            showError(sheetContext, e);
                          }
                        }
                      },
                child: saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('حفظ'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
