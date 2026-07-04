import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

class RequestsScreen extends StatefulWidget {
  const RequestsScreen({super.key});
  @override
  State<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends State<RequestsScreen> {
  String? _status;
  String _search = '';
  Timer? _debounce;
  late Future<({List<RequestLead> requests, Map<String, int> counts})> _data = Api.requests();

  void _reload() => setState(() => _data = Api.requests(status: _status, search: _search));

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _setStatus(RequestLead r, String status) async {
    try {
      await Api.updateRequestStatus(r.id, status);
      if (mounted) {
        showOk(context, 'تم تحديث الحالة');
        _reload();
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            decoration: const InputDecoration(hintText: 'ابحث بالاسم أو الكتاب...', prefixIcon: Icon(Icons.search, size: 20)),
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
              for (final s in requestStatusLabels.entries) _filterChip(s.key, s.value),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () async => _reload(),
            child: FutureBuilder<({List<RequestLead> requests, Map<String, int> counts})>(
              future: _data,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) return const LoadingView();
                if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
                final requests = snap.data!.requests;
                if (requests.isEmpty) return const EmptyView('لا توجد طلبات كتب');
                return ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: requests.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) => _requestCard(requests[i]),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _requestCard(RequestLead r) {
    final phoneDigits = r.phone.replaceAll(RegExp(r'[^0-9]'), '');
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(r.customer, style: const TextStyle(fontWeight: FontWeight.w800))),
                StatusChip(r.status, labels: requestStatusLabels),
              ],
            ),
            const SizedBox(height: 4),
            Text('📖 ${r.bookName}', style: const TextStyle(fontSize: 13)),
            const SizedBox(height: 2),
            Text('${r.wilaya} · ${shortDate(r.createdAt)}',
                style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            const SizedBox(height: 10),
            Row(
              children: [
                _action(Icons.phone_outlined, 'اتصال', () => launchUrl(Uri.parse('tel:${r.phone}'))),
                const SizedBox(width: 8),
                _action(Icons.chat_outlined, 'واتساب',
                    () => launchUrl(Uri.parse('https://wa.me/$phoneDigits'), mode: LaunchMode.externalApplication)),
                const Spacer(),
                if (r.status == 'pending')
                  _action(Icons.task_alt, 'تم التواصل', () => _setStatus(r, 'contacted'), primary: true)
                else if (r.status == 'contacted')
                  _action(Icons.check_circle_outline, 'اكتمل', () => _setStatus(r, 'done'), primary: true),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback onTap, {bool primary = false}) => primary
      ? FilledButton.tonalIcon(
          style: FilledButton.styleFrom(
              backgroundColor: AppColors.goldLight,
              foregroundColor: const Color(0xFF8A6620),
              visualDensity: VisualDensity.compact),
          onPressed: onTap,
          icon: Icon(icon, size: 16),
          label: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))
      : OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
              visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6)),
          onPressed: onTap,
          icon: Icon(icon, size: 16),
          label: Text(label, style: const TextStyle(fontSize: 12)));

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
