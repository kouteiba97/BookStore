import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

/// Allowed transitions — mirrors src/modules/admin/orders/order-rules.ts.
const _transitions = <String, List<String>>{
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'cancelled'],
  'delivered': [],
  'cancelled': [],
};

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Future<AdminOrder> _order = Api.order(widget.orderId);
  bool _busy = false;

  void _reload() => setState(() => _order = Api.order(widget.orderId));

  Future<void> _setStatus(String status) async {
    final label = orderStatusLabels[status] ?? status;
    if (status == 'cancelled' && !await confirmDialog(context, 'إلغاء الطلبية؟')) return;
    setState(() => _busy = true);
    try {
      await Api.updateOrderStatus(widget.orderId, status);
      if (mounted) {
        showOk(context, 'تم التحديث إلى «$label»');
        _reload();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل الطلبية')),
      body: FutureBuilder<AdminOrder>(
        future: _order,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
          final o = snap.data!;
          final next = _transitions[o.status] ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(o.customer, style: heading(size: 20))),
                          StatusChip(o.status),
                        ],
                      ),
                      const SizedBox(height: 10),
                      _info(Icons.phone_outlined, o.phone, onTap: () => launchUrl(Uri.parse('tel:${o.phone}'))),
                      _info(Icons.chat_outlined, 'واتساب',
                          onTap: () => launchUrl(Uri.parse('https://wa.me/${o.phone.replaceAll(RegExp(r'[^0-9]'), '')}'),
                              mode: LaunchMode.externalApplication)),
                      _info(Icons.location_on_outlined, '${o.wilaya} — ${o.address}'),
                      _info(Icons.calendar_today_outlined, shortDate(o.createdAt)),
                      if (o.notes != null && o.notes!.isNotEmpty) _info(Icons.notes_outlined, o.notes!),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text('العناصر', style: heading(size: 18)),
              const SizedBox(height: 8),
              Card(
                margin: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final it in o.items)
                      ListTile(
                        leading: CoverThumb(imageUrl: it.bookImageUrl, size: 40),
                        title: Text(it.bookTitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5)),
                        subtitle: Text('${money(it.unitPrice)} × ${it.quantity}', style: const TextStyle(fontSize: 12)),
                        trailing: Text(money(it.unitPrice * it.quantity),
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      ),
                    const Divider(height: 1),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        children: [
                          _totalRow('المجموع الفرعي', money(o.subtotal)),
                          _totalRow('التوصيل', money(o.shippingCost)),
                          const SizedBox(height: 6),
                          _totalRow('الإجمالي', money(o.total), bold: true),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (next.isNotEmpty) ...[
                Text('تغيير الحالة', style: heading(size: 18)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (final s in next) ...[
                      Expanded(
                        child: s == 'cancelled'
                            ? OutlinedButton(
                                onPressed: _busy ? null : () => _setStatus(s),
                                style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.destructive,
                                    side: const BorderSide(color: AppColors.destructive)),
                                child: Text(orderStatusLabels[s]!),
                              )
                            : ElevatedButton(
                                onPressed: _busy ? null : () => _setStatus(s),
                                child: Text('${orderStatusLabels[s]} ←'),
                              ),
                      ),
                      if (s != next.last) const SizedBox(width: 10),
                    ],
                  ],
                ),
              ] else if (o.status == 'cancelled') ...[
                OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          if (!await confirmDialog(context, 'حذف الطلبية نهائيًا؟',
                              body: 'لا يمكن التراجع عن هذا الإجراء.')) {
                            return;
                          }
                          try {
                            await Api.deleteOrder(o.id);
                            if (context.mounted) Navigator.of(context).pop();
                          } catch (e) {
                            if (context.mounted) showError(context, e);
                          }
                        },
                  style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.destructive, side: const BorderSide(color: AppColors.destructive)),
                  icon: const Icon(Icons.delete_outline, size: 20),
                  label: const Text('حذف الطلبية'),
                ),
              ],
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }

  Widget _info(IconData icon, String text, {VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Icon(icon, size: 17, color: AppColors.mutedForeground),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(text,
                      style: TextStyle(
                          fontSize: 13, color: onTap == null ? AppColors.foreground : AppColors.primary,
                          fontWeight: onTap == null ? FontWeight.normal : FontWeight.w700))),
            ],
          ),
        ),
      );

  Widget _totalRow(String label, String value, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    fontSize: bold ? 15 : 13,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.normal,
                    color: bold ? AppColors.foreground : AppColors.mutedForeground)),
            Text(value,
                style: TextStyle(
                    fontSize: bold ? 16 : 13,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                    color: bold ? AppColors.primary : AppColors.foreground)),
          ],
        ),
      );
}
