import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String? _status;
  String _search = '';
  Timer? _debounce;
  late Future<OrdersPage> _page = Api.orders();

  void _reload() => setState(() => _page = Api.orders(status: _status, search: _search));

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
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            decoration: const InputDecoration(hintText: 'ابحث بالاسم أو الهاتف...', prefixIcon: Icon(Icons.search, size: 20)),
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
              _filterChip(null, 'الكل'),
              for (final s in orderStatusLabels.entries) _filterChip(s.key, s.value),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () async => _reload(),
            child: FutureBuilder<OrdersPage>(
              future: _page,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
                if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
                final page = snap.data!;
                if (page.orders.isEmpty) return const EmptyView('لا توجد طلبيات');
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: page.orders.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final o = page.orders[i];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        onTap: () async {
                          await Navigator.of(context)
                              .push(MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
                          _reload();
                        },
                        title: Text(o.customer, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                          '${o.items.length} عنصر · ${o.wilaya} · ${shortDate(o.createdAt)}',
                          style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(money(o.total),
                                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary, fontSize: 13)),
                            const SizedBox(height: 4),
                            StatusChip(o.status),
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
}
