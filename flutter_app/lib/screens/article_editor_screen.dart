import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/article_service.dart';
import '../services/media_service.dart';

/// انعكاس مباشر لـ ArticleEditorModal.tsx — نفس الحقول بالضبط (المحتوى
/// نص عادي وليس HTML، كما في الموقع فعلياً)، ونفس زري "حفظ كمسودة" /
/// "نشر المقال".
const _kCategories = <String, String>{
  'literature': 'أدب',
  'technology': 'تقنية',
  'history': 'تاريخ',
  'philosophy': 'فلسفة',
  'business': 'أعمال',
  'science': 'علوم',
  'health': 'صحة',
  'arts': 'فنون',
  'politics': 'سياسة',
  'education': 'تعليم',
  'beauty_fashion': 'جمال وموضة',
  'sports': 'رياضة',
  'food': 'طعام',
  'travel': 'سفر',
  'family': 'أسرة',
  'general': 'عام',
};

class ArticleEditorScreen extends StatefulWidget {
  const ArticleEditorScreen({super.key});

  @override
  State<ArticleEditorScreen> createState() => _ArticleEditorScreenState();
}

class _ArticleEditorScreenState extends State<ArticleEditorScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _contentController = TextEditingController();
  final _tagsController = TextEditingController();
  final _priceController = TextEditingController(text: '3.0');
  final _picker = ImagePicker();
  final _articleService = ArticleService();
  final _mediaService = MediaService();

  String _category = 'literature';
  String? _coverPath;
  String? _uploadedCoverUrl;
  bool _isLocked = false;
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _contentController.dispose();
    _tagsController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _pickCover() async {
    final file = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file == null) return;
    setState(() {
      _coverPath = file.path;
      _uploadedCoverUrl = null;
    });
  }

  Future<void> _save(String status) async {
    if (_titleController.text.trim().isEmpty || _contentController.text.trim().isEmpty) {
      setState(() => _error = 'العنوان والمحتوى مطلوبان.');
      return;
    }
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() {
      _isSaving = true;
      _error = null;
    });

    try {
      String featuredImage = _uploadedCoverUrl ?? '';
      if (_coverPath != null && _uploadedCoverUrl == null) {
        final idToken = await user.getIdToken();
        final result = await _mediaService.upload(idToken: idToken!, filePath: _coverPath!, purpose: 'article');
        if (!result.success) {
          setState(() {
            _error = result.message;
            _isSaving = false;
          });
          return;
        }
        featuredImage = result.url ?? '';
        _uploadedCoverUrl = featuredImage;
      }

      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final userData = userDoc.data() ?? {};

      final tags = _tagsController.text
          .split(',')
          .map((t) => t.trim().replaceAll('#', ''))
          .where((t) => t.isNotEmpty)
          .toList();

      await _articleService.publishArticle(
        writerId: user.uid,
        writerName: (userData['fullName'] ?? '') as String,
        writerUsername: (userData['username'] ?? '') as String,
        writerAvatar: (userData['avatarUrl'] ?? '') as String,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim().isEmpty
            ? _titleController.text.trim()
            : _descriptionController.text.trim(),
        content: _contentController.text.trim(),
        featuredImage: featuredImage,
        category: _category,
        tags: tags,
        isLocked: _isLocked,
        lockedPrice: _isLocked ? double.tryParse(_priceController.text) ?? 3.0 : null,
        status: status,
      );

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(status == 'draft' ? 'تم حفظ المسودة' : 'تم نشر المقال ✓')),
        );
      }
    } catch (_) {
      setState(() => _error = 'تعذر حفظ المقال. حاول مجدداً.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('مقال جديد')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            GestureDetector(
              onTap: _pickCover,
              child: _coverPath != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(File(_coverPath!), height: 160, width: double.infinity, fit: BoxFit.cover),
                    )
                  : Container(
                      height: 120,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade400),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(child: Text('انقر لإضافة صورة الغلاف')),
                    ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'العنوان', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'وصف مختصر (اختياري)', border: OutlineInputBorder()),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _category,
              decoration: const InputDecoration(labelText: 'التصنيف', border: OutlineInputBorder()),
              items: _kCategories.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
              onChanged: (v) => setState(() => _category = v ?? _category),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _tagsController,
              decoration: const InputDecoration(labelText: 'وسوم مفصولة بفواصل', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _contentController,
              decoration: const InputDecoration(labelText: 'المحتوى', border: OutlineInputBorder(), alignLabelWithHint: true),
              maxLines: 14,
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('مقال مدفوع (مقفل)'),
              value: _isLocked,
              onChanged: (v) => setState(() => _isLocked = v),
            ),
            if (_isLocked)
              TextField(
                controller: _priceController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'السعر بالدولار', border: OutlineInputBorder()),
              ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isSaving ? null : () => _save('draft'),
                    child: const Text('حفظ كمسودة'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _isSaving ? null : () => _save('published'),
                    child: Text(_isSaving ? 'جارِ النشر...' : 'نشر المقال'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
