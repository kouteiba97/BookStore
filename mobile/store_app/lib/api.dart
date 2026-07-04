import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

/// Same defaults as the web storefront; override at build time with
/// --dart-define=API_URL=... --dart-define=STORE_SLUG=... --dart-define=WHATSAPP_NUMBER=...
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://bookstore-api-uzrj.onrender.com');
const storeSlug = String.fromEnvironment('STORE_SLUG', defaultValue: 'elbayan');
const whatsappNumber = String.fromEnvironment('WHATSAPP_NUMBER', defaultValue: '213777887762');

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

class Api {
  static const _base = '$apiUrl/api/v1/$storeSlug';

  static Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    final uri = Uri.parse('$_base$path').replace(queryParameters: query);
    final res = await http.get(uri).timeout(const Duration(seconds: 75));
    return _decode(res);
  }

  static Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    final res = await http
        .post(Uri.parse('$_base$path'),
            headers: {'Content-Type': 'application/json'}, body: jsonEncode(body))
        .timeout(const Duration(seconds: 75));
    return _decode(res);
  }

  static dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      final msg = body is Map && body['message'] != null ? body['message'].toString() : 'حدث خطأ، حاول مجددًا';
      throw ApiException(res.statusCode, msg);
    }
    return body;
  }

  // ── Books ────────────────────────────────────────────────
  static Future<List<Book>> fetchBooks() async =>
      ((await _get('/books')) as List).map((e) => Book.fromJson(e)).toList();

  static Future<Book> fetchBook(String id) async => Book.fromJson(await _get('/books/$id'));

  static Future<List<Book>> searchBooks(String q) async =>
      ((await _get('/books/search', {'q': q})) as List).map((e) => Book.fromJson(e)).toList();

  static Future<Suggestions> fetchSuggestions(String q) async =>
      Suggestions.fromJson(await _get('/books/suggestions', {'q': q}));

  static Future<List<Book>> fetchRecommendations(String id) async =>
      ((await _get('/books/$id/recommendations')) as List).map((e) => Book.fromJson(e)).toList();

  // ── Academic taxonomy ────────────────────────────────────
  static Future<List<Field>> fetchFields() async =>
      ((await _get('/fields')) as List).map((e) => Field.fromJson(e)).toList();

  static Future<List<AcademicYear>> fetchYears(String fieldId) async =>
      ((await _get('/fields/$fieldId/years')) as List).map((e) => AcademicYear.fromJson(e)).toList();

  static Future<List<Subject>> fetchSubjects(String yearId) async =>
      ((await _get('/years/$yearId/subjects')) as List).map((e) => Subject.fromJson(e)).toList();

  static Future<List<Book>> fetchSubjectBooks(String subjectId) async =>
      ((await _get('/subjects/$subjectId/books')) as List).map((e) => Book.fromJson(e)).toList();

  // ── Book request lead → server saves it and returns a WhatsApp link ──
  static Future<String?> createRequest({
    required String firstName,
    required String lastName,
    required String phone,
    required String wilaya,
    required String address,
    String? bookId,
    required String bookName,
  }) async {
    final data = await _post('/requests', {
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      'wilaya': wilaya,
      'address': address,
      if (bookId != null) 'bookId': bookId,
      'bookName': bookName,
    });
    return data is Map ? data['whatsappUrl'] as String? : null;
  }
}
