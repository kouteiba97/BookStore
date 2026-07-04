import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'theme.dart';

class BrandLogo extends StatelessWidget {
  final double size;
  const BrandLogo({super.key, this.size = 40});
  @override
  Widget build(BuildContext context) => SvgPicture.asset('assets/logo.svg', width: size, height: size);
}

// ── Status labels (Arabic, matching the web admin) ─────────
const orderStatusLabels = {
  'pending': 'قيد الانتظار',
  'confirmed': 'مؤكد',
  'shipped': 'تم الشحن',
  'delivered': 'تم التسليم',
  'cancelled': 'ملغى',
};

const requestStatusLabels = {
  'pending': 'جديد',
  'contacted': 'تم التواصل',
  'done': 'مكتمل',
};

const inventoryStatusLabels = {
  'available': 'متوفر',
  'on_request': 'عند الطلب',
  'rare': 'نادر',
};

Color statusColor(String status) => switch (status) {
      'pending' => const Color(0xFFB98A2E),
      'confirmed' => AppColors.primary,
      'shipped' => const Color(0xFF2D5D8A),
      'delivered' || 'done' || 'available' => AppColors.success,
      'cancelled' => AppColors.destructive,
      'contacted' => const Color(0xFF2D5D8A),
      'rare' => const Color(0xFF8A6620),
      _ => AppColors.mutedForeground,
    };

class StatusChip extends StatelessWidget {
  final String status;
  final Map<String, String> labels;
  const StatusChip(this.status, {super.key, this.labels = orderStatusLabels});

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(labels[status] ?? status,
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

String money(num? v) => v == null ? '—' : '${v.toStringAsFixed(0)} د.ج';

String shortDate(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  return '${d.year}/${d.month.toString().padLeft(2, '0')}/${d.day.toString().padLeft(2, '0')}';
}

class CoverThumb extends StatelessWidget {
  final String? imageUrl;
  final double size;
  const CoverThumb({super.key, this.imageUrl, this.size = 48});

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size * 4 / 3,
      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
      child: Icon(Icons.menu_book_rounded, color: AppColors.goldLight.withValues(alpha: 0.8), size: size * 0.45),
    );
    if (imageUrl == null || imageUrl!.isEmpty) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: CachedNetworkImage(
        imageUrl: imageUrl!,
        width: size,
        height: size * 4 / 3,
        fit: BoxFit.cover,
        placeholder: (_, _) => placeholder,
        errorWidget: (_, _, _) => placeholder,
      ),
    );
  }
}

class KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  const KpiCard({super.key, required this.label, required this.value, required this.icon, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.primary;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, size: 18, color: c),
              const Spacer(),
            ]),
            const SizedBox(height: 10),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c)),
            Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: AppColors.gold)));
}

class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.error, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.mutedForeground),
              const SizedBox(height: 12),
              Text(error.toString(),
                  textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground)),
              const SizedBox(height: 16),
              OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );
}

class EmptyView extends StatelessWidget {
  final String message;
  const EmptyView(this.message, {super.key});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.inbox_outlined, size: 40, color: AppColors.mutedForeground),
            const SizedBox(height: 12),
            Text(message, style: const TextStyle(color: AppColors.mutedForeground)),
          ]),
        ),
      );
}

Future<bool> confirmDialog(BuildContext context, String title, {String? body}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        title: Text(title, style: heading(size: 18)),
        content: body == null ? null : Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('تأكيد', style: TextStyle(color: AppColors.destructive, fontWeight: FontWeight.w700))),
        ],
      ),
    ),
  );
  return ok ?? false;
}

/// Simple one-field prompt used across catalog/academic CRUD.
Future<String?> promptName(BuildContext context, String title, {String? initial}) {
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (context) => Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        title: Text(title, style: heading(size: 18)),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(hintText: 'الاسم')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('إلغاء')),
          TextButton(
              onPressed: () {
                final v = controller.text.trim();
                if (v.isNotEmpty) Navigator.pop(context, v);
              },
              child: const Text('حفظ', style: TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    ),
  );
}

void showError(BuildContext context, Object e) => ScaffoldMessenger.of(context)
    .showSnackBar(SnackBar(backgroundColor: AppColors.destructive, content: Text(e.toString())));

void showOk(BuildContext context, String message) => ScaffoldMessenger.of(context)
    .showSnackBar(SnackBar(backgroundColor: AppColors.success, content: Text(message)));
