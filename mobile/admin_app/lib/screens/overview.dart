import 'package:flutter/material.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

class OverviewScreen extends StatefulWidget {
  const OverviewScreen({super.key});
  @override
  State<OverviewScreen> createState() => _OverviewScreenState();
}

class _OverviewScreenState extends State<OverviewScreen> {
  int _days = 30;
  late Future<StatsOverview> _stats = Api.stats(days: _days);

  void _reload([int? days]) => setState(() {
        if (days != null) _days = days;
        _stats = Api.stats(days: _days);
      });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: () async => _reload(),
      child: FutureBuilder<StatsOverview>(
        future: _stats,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
          final s = snap.data!;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Text('آخر $_days يوم', style: const TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
                  const Spacer(),
                  SegmentedButton<int>(
                    style: SegmentedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    segments: const [
                      ButtonSegment(value: 7, label: Text('7')),
                      ButtonSegment(value: 30, label: Text('30')),
                      ButtonSegment(value: 90, label: Text('90')),
                    ],
                    selected: {_days},
                    onSelectionChanged: (v) => _reload(v.first),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.65,
                children: [
                  KpiCard(label: 'الإيرادات', value: money(s.totalRevenue), icon: Icons.payments_outlined),
                  KpiCard(label: 'الطلبيات', value: '${s.totalOrders}', icon: Icons.receipt_long_outlined, color: const Color(0xFF2D5D8A)),
                  KpiCard(label: 'طلبات الكتب', value: '${s.totalRequests}', icon: Icons.mark_chat_unread_outlined, color: const Color(0xFFB98A2E)),
                  KpiCard(label: 'نسبة التحويل', value: '${s.conversionRate.toStringAsFixed(0)}٪', icon: Icons.swap_calls_rounded, color: AppColors.success),
                  KpiCard(label: 'الكتب', value: '${s.booksCount}', icon: Icons.menu_book_outlined),
                  KpiCard(label: 'مخزون منخفض', value: '${s.lowStockCount}', icon: Icons.warning_amber_rounded, color: AppColors.destructive),
                ],
              ),
              const SizedBox(height: 18),
              _statusCard('الطلبيات حسب الحالة', s.ordersByStatus, orderStatusLabels),
              const SizedBox(height: 10),
              _statusCard('طلبات الكتب حسب الحالة', s.requestsByStatus, requestStatusLabels),
              if (s.topBooks.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text('الأكثر مبيعًا', style: heading(size: 18)),
                const SizedBox(height: 8),
                Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final (i, t) in s.topBooks.indexed)
                        ListTile(
                          dense: true,
                          leading: CircleAvatar(
                              radius: 13,
                              backgroundColor: AppColors.goldLight,
                              child: Text('${i + 1}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF8A6620)))),
                          title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                          trailing: Text('${t.quantity} نسخة',
                              style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
                        ),
                    ],
                  ),
                ),
              ],
              if (s.recentOrders.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text('أحدث الطلبيات', style: heading(size: 18)),
                const SizedBox(height: 8),
                Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final o in s.recentOrders)
                        ListTile(
                          dense: true,
                          title: Text(o.name),
                          subtitle: Text(money(o.total), style: const TextStyle(fontSize: 12)),
                          trailing: StatusChip(o.status),
                        ),
                    ],
                  ),
                ),
              ],
              if (s.recentRequests.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text('أحدث طلبات الكتب', style: heading(size: 18)),
                const SizedBox(height: 8),
                Card(
                  margin: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final r in s.recentRequests)
                        ListTile(
                          dense: true,
                          title: Text(r.name),
                          subtitle: Text(r.bookName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                          trailing: StatusChip(r.status, labels: requestStatusLabels),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }

  Widget _statusCard(String title, Map<String, int> counts, Map<String, String> labels) {
    final total = counts.values.fold<int>(0, (a, b) => a + b);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: heading(size: 16)),
            const SizedBox(height: 10),
            if (total == 0)
              const Text('لا بيانات بعد', style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))
            else
              for (final e in counts.entries) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      SizedBox(width: 84, child: Text(labels[e.key] ?? e.key, style: const TextStyle(fontSize: 12))),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: total == 0 ? 0 : e.value / total,
                            minHeight: 8,
                            backgroundColor: AppColors.muted,
                            color: statusColor(e.key),
                          ),
                        ),
                      ),
                      SizedBox(
                          width: 34,
                          child: Text('${e.value}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                    ],
                  ),
                ),
              ],
          ],
        ),
      ),
    );
  }
}
