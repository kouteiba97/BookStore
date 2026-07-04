import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

/// Quick-Add — mobile book entry, mirroring admin/src/pages/admin/quick-add.tsx.
/// Also doubles as the edit form when [existing] is provided.
/// Free-text category/author/publisher/country are found-or-created server-side.
class QuickAddScreen extends StatefulWidget {
  final AdminBook? existing;
  const QuickAddScreen({super.key, this.existing});

  @override
  State<QuickAddScreen> createState() => _QuickAddScreenState();
}

class _QuickAddScreenState extends State<QuickAddScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late final _title = TextEditingController(text: widget.existing?.title);
  late final _category = TextEditingController(text: widget.existing?.category?.name);
  late final _author = TextEditingController(text: widget.existing?.author?.name);
  late final _publisher = TextEditingController(text: widget.existing?.publisher?.name);
  late final _country = TextEditingController(text: widget.existing?.country?.name);
  late final _year = TextEditingController(text: widget.existing?.year?.toString());
  late final _price = TextEditingController(text: widget.existing?.price?.toStringAsFixed(0));
  late final _stock = TextEditingController(text: widget.existing?.inventory?.stock?.toString());
  late final _description = TextEditingController(text: widget.existing?.description);

  late String _inventoryStatus = widget.existing?.inventory?.status ?? 'available';
  String? _imageUrl;
  File? _pickedImage;
  bool _uploading = false;
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _imageUrl = widget.existing?.imageUrl;
  }

  Future<void> _pickImage(ImageSource source) async {
    final file = await _picker.pickImage(source: source, maxWidth: 1600, imageQuality: 88);
    if (file == null) return;
    setState(() {
      _pickedImage = File(file.path);
      _uploading = true;
    });
    try {
      final url = await Api.uploadCover(File(file.path));
      if (mounted) setState(() => _imageUrl = url);
    } catch (e) {
      if (mounted) {
        setState(() => _pickedImage = null);
        showError(context, e);
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Map<String, dynamic> _payload() => {
        'title': _title.text.trim(),
        if (_category.text.trim().isNotEmpty) 'categoryName': _category.text.trim(),
        if (_author.text.trim().isNotEmpty) 'authorName': _author.text.trim(),
        if (_publisher.text.trim().isNotEmpty) 'publisherName': _publisher.text.trim(),
        if (_country.text.trim().isNotEmpty) 'countryName': _country.text.trim(),
        if (_year.text.trim().isNotEmpty) 'year': int.tryParse(_year.text.trim()),
        if (_price.text.trim().isNotEmpty) 'price': num.tryParse(_price.text.trim()),
        if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
        if (_imageUrl != null) 'imageUrl': _imageUrl,
        'inventory': {
          'status': _inventoryStatus,
          if (_stock.text.trim().isNotEmpty) 'stock': int.tryParse(_stock.text.trim()),
        },
      };

  Future<void> _save({bool addAnother = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      if (_isEdit) {
        await Api.updateBook(widget.existing!.id, _payload());
      } else {
        await Api.createBook(_payload());
      }
      if (!mounted) return;
      showOk(context, _isEdit ? 'تم حفظ التعديلات' : 'تمت إضافة الكتاب');
      if (addAnother) {
        _formKey.currentState!.reset();
        for (final c in [_title, _author, _year, _price, _stock, _description]) {
          c.clear();
        }
        setState(() {
          _imageUrl = null;
          _pickedImage = null;
          _saving = false;
        });
      } else {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showError(context, e);
      }
    }
  }

  Future<void> _delete() async {
    if (!await confirmDialog(context, 'حذف الكتاب؟', body: 'سيُحذف «${widget.existing!.title}» نهائيًا.')) return;
    try {
      await Api.deleteBook(widget.existing!.id);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'تعديل كتاب' : 'إضافة سريعة'),
        actions: [
          if (_isEdit)
            IconButton(icon: const Icon(Icons.delete_outline, size: 22), onPressed: _saving ? null : _delete),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _coverPicker(),
            const SizedBox(height: 16),
            _label('العنوان *'),
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(hintText: 'عنوان الكتاب'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'العنوان مطلوب' : null,
            ),
            const SizedBox(height: 12),
            _label('التصنيف'),
            TextFormField(
                controller: _category,
                decoration: const InputDecoration(hintText: 'اكتب تصنيفًا (يُضاف تلقائيًا إن كان جديدًا)')),
            const SizedBox(height: 12),
            _label('المؤلف'),
            TextFormField(
                controller: _author,
                decoration: const InputDecoration(hintText: 'اسم المؤلف — يُضاف تلقائيًا إن لم يكن موجودًا')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _label('دار النشر'),
                TextFormField(controller: _publisher, decoration: const InputDecoration(hintText: 'دار النشر')),
              ])),
              const SizedBox(width: 10),
              Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _label('البلد'),
                TextFormField(controller: _country, decoration: const InputDecoration(hintText: 'بلد النشر')),
              ])),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _label('سنة النشر'),
                TextFormField(
                    controller: _year,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(hintText: 'مثال: 2019')),
              ])),
              const SizedBox(width: 10),
              Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _label('السعر (د.ج)'),
                TextFormField(
                    controller: _price,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(hintText: 'السعر')),
              ])),
            ]),
            const SizedBox(height: 12),
            _label('حالة التوفر'),
            SegmentedButton<String>(
              style: SegmentedButton.styleFrom(textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              segments: [
                for (final e in inventoryStatusLabels.entries) ButtonSegment(value: e.key, label: Text(e.value)),
              ],
              selected: {_inventoryStatus},
              onSelectionChanged: (v) => setState(() => _inventoryStatus = v.first),
            ),
            const SizedBox(height: 12),
            _label('الكمية في المخزون'),
            TextFormField(
                controller: _stock,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: 'اتركه فارغًا إن لم يكن محددًا')),
            const SizedBox(height: 12),
            _label('الوصف'),
            TextFormField(
                controller: _description,
                maxLines: 4,
                decoration: const InputDecoration(hintText: 'نبذة عن الكتاب (اختياري)')),
            const SizedBox(height: 20),
            if (_isEdit)
              ElevatedButton(
                onPressed: _saving || _uploading ? null : () => _save(),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('حفظ التعديلات'),
              )
            else ...[
              ElevatedButton(
                onPressed: _saving || _uploading ? null : () => _save(addAnother: true),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('حفظ وإضافة كتاب آخر'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: _saving || _uploading ? null : () => _save(), child: const Text('حفظ وإغلاق')),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _coverPicker() {
    final preview = _pickedImage != null
        ? Image.file(_pickedImage!, fit: BoxFit.cover)
        : (_imageUrl != null && _imageUrl!.isNotEmpty ? Image.network(_imageUrl!, fit: BoxFit.cover) : null);
    return Column(
      children: [
        InkWell(
          onTap: _uploading ? null : () => _showPickSheet(),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 170,
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border, width: 1.4),
            ),
            clipBehavior: Clip.antiAlias,
            child: preview != null
                ? Stack(fit: StackFit.expand, children: [
                    preview,
                    if (_uploading)
                      Container(
                          color: Colors.black38,
                          child: const Center(child: CircularProgressIndicator(color: Colors.white))),
                  ])
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.photo_camera_outlined, size: 34, color: AppColors.mutedForeground),
                      const SizedBox(height: 8),
                      Text('التقط صورة الغلاف أو اختر من المعرض',
                          style: heading(size: 15, weight: FontWeight.w700)),
                      const Text('اختياري', style: TextStyle(fontSize: 11, color: AppColors.mutedForeground)),
                    ],
                  ),
          ),
        ),
        if (preview != null && !_uploading)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton(
                    style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                    onPressed: _showPickSheet,
                    child: const Text('تغيير الصورة', style: TextStyle(fontSize: 12))),
                const SizedBox(width: 8),
                TextButton(
                    onPressed: () => setState(() {
                          _imageUrl = null;
                          _pickedImage = null;
                        }),
                    child: const Text('إزالة', style: TextStyle(fontSize: 12, color: AppColors.destructive))),
              ],
            ),
          ),
      ],
    );
  }

  void _showPickSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('التقاط صورة'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('اختيار من المعرض'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
      );
}
