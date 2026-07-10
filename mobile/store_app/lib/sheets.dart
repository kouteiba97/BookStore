import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'models.dart';
import 'theme.dart';
import 'wilayas.dart';

/// Order via WhatsApp — mirrors frontend order-modal.tsx: the message is
/// composed client-side and the conversation continues on WhatsApp.
Future<void> showOrderSheet(BuildContext context, Book book) =>
    _showFormSheet(context, title: 'اطلب «${book.title}»', submitLabel: 'إرسال الطلب عبر واتساب',
        onSubmit: (form) async {
      final message = '''📚 طلب كتاب من مكتبة البيان

📖 الكتاب: ${book.title}${book.price != null ? '\n💰 السعر: ${book.price!.toStringAsFixed(0)} د.ج' : ''}
👤 الاسم: ${form.firstName} ${form.lastName}
📞 الهاتف: ${form.phone}
📍 الولاية: ${form.wilaya}''';
      final url = Uri.parse('https://wa.me/$whatsappNumber?text=${Uri.encodeComponent(message)}');
      await launchUrl(url, mode: LaunchMode.externalApplication);
      return null;
    });

/// Book-request lead — mirrors request-dialog.tsx: the lead is saved
/// server-side (POST /requests), then WhatsApp opens with the returned URL.
/// With no [bookName] (the home-page banner), the form asks for the title.
Future<void> showRequestSheet(BuildContext context, {String? bookId, String? bookName}) =>
    _showFormSheet(context,
        title: bookName == null ? 'اطلب كتابك الآن' : 'اطلب توفير «$bookName»',
        submitLabel: 'إرسال الطلب',
        needsAddress: true,
        askBookName: bookName == null, onSubmit: (form) async {
      final whatsappUrl = await Api.createRequest(
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        wilaya: form.wilaya,
        address: form.address,
        bookId: bookId,
        bookName: bookName ?? form.bookName,
      );
      if (whatsappUrl != null) {
        await launchUrl(Uri.parse(whatsappUrl), mode: LaunchMode.externalApplication);
      }
      return 'تم إرسال طلبك بنجاح — سنتواصل معك قريبًا';
    });

class _FormData {
  String firstName = '', lastName = '', phone = '', wilaya = '', address = '', bookName = '';
}

Future<void> _showFormSheet(
  BuildContext context, {
  required String title,
  required String submitLabel,
  bool needsAddress = false,
  bool askBookName = false,
  required Future<String?> Function(_FormData) onSubmit,
}) {
  final form = _FormData();
  final formKey = GlobalKey<FormState>();
  var submitting = false;

  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.background,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (sheetContext) => StatefulBuilder(
      builder: (sheetContext, setSheetState) => Padding(
        padding: EdgeInsets.only(
            left: 20, right: 20, top: 20, bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20),
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                      width: 40, height: 4,
                      decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
                ),
                const SizedBox(height: 16),
                Text(title, textAlign: TextAlign.center, style: heading(size: 19)),
                const SizedBox(height: 16),
                if (askBookName) ...[
                  _field('اسم الكتاب المطلوب', (v) => form.bookName = v),
                  const SizedBox(height: 10),
                ],
                Row(children: [
                  Expanded(child: _field('الاسم', (v) => form.firstName = v)),
                  const SizedBox(width: 10),
                  Expanded(child: _field('اللقب', (v) => form.lastName = v)),
                ]),
                const SizedBox(height: 10),
                _field('رقم الهاتف', (v) => form.phone = v, keyboard: TextInputType.phone),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(hintText: 'الولاية'),
                  items: [for (final w in wilayas) DropdownMenuItem(value: w, child: Text(w))],
                  onChanged: (v) => form.wilaya = v ?? '',
                  validator: (v) => (v == null || v.isEmpty) ? 'اختر الولاية' : null,
                ),
                if (needsAddress) ...[
                  const SizedBox(height: 10),
                  _field('العنوان', (v) => form.address = v),
                ],
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          formKey.currentState!.save();
                          setSheetState(() => submitting = true);
                          try {
                            final successMessage = await onSubmit(form);
                            if (sheetContext.mounted) {
                              Navigator.of(sheetContext).pop();
                              if (successMessage != null) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                    backgroundColor: AppColors.success, content: Text(successMessage)));
                              }
                            }
                          } catch (e) {
                            if (sheetContext.mounted) {
                              setSheetState(() => submitting = false);
                              ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(
                                  backgroundColor: AppColors.destructive, content: Text(e.toString())));
                            }
                          }
                        },
                  child: submitting
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(submitLabel),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

Widget _field(String hint, void Function(String) onSaved, {TextInputType? keyboard}) => TextFormField(
      decoration: InputDecoration(hintText: hint),
      keyboardType: keyboard,
      validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
      onSaved: (v) => onSaved(v!.trim()),
      onChanged: onSaved,
    );
