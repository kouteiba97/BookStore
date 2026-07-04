import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

/// Same defaults as the web admin; override at build time with
/// --dart-define=API_URL=... --dart-define=STORE_SLUG=...
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'https://bookstore-api-uzrj.onrender.com');
const storeSlug = String.fromEnvironment('STORE_SLUG', defaultValue: 'elbayan');

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

/// Token store — mirrors admin/src/lib/auth.ts (30-day JWT from the API).
class Auth {
  static const _key = 'admin_token';
  static String? _token;

  static Future<void> load() async {
    _token = (await SharedPreferences.getInstance()).getString(_key);
  }

  static bool get isLoggedIn => _token != null && _token!.isNotEmpty;
  static String? get token => _token;

  static Future<void> save(String token) async {
    _token = token;
    await (await SharedPreferences.getInstance()).setString(_key, token);
  }

  static Future<void> logout() async {
    _token = null;
    await (await SharedPreferences.getInstance()).remove(_key);
  }
}

class Api {
  static const _admin = '$apiUrl/api/v1/admin';
  static const _store = '$apiUrl/api/v1/$storeSlug';

  static Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        if (Auth.isLoggedIn) 'Authorization': 'Bearer ${Auth.token}',
      };

  static Future<dynamic> _send(String method, String url,
      {Map<String, dynamic>? body, Map<String, String>? query}) async {
    final uri = Uri.parse(url).replace(queryParameters: query);
    final req = http.Request(method, uri)..headers.addAll(_headers());
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 75)));
    final decoded = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode == 401) {
      await Auth.logout();
      throw ApiException(401, 'انتهت الجلسة — سجّل الدخول مجددًا');
    }
    if (res.statusCode >= 400) {
      final msg = decoded is Map && decoded['message'] != null ? decoded['message'].toString() : 'حدث خطأ';
      throw ApiException(res.statusCode, msg);
    }
    return decoded;
  }

  // ── Auth ─────────────────────────────────────────────────
  static Future<void> login(String password) async {
    final data = await _send('POST', '$_admin/auth/login', body: {'password': password});
    await Auth.save(data['token']);
  }

  // ── Stats ────────────────────────────────────────────────
  static Future<StatsOverview> stats({int days = 30}) async =>
      StatsOverview.fromJson(await _send('GET', '$_admin/stats/overview', query: {'days': '$days'}));

  // ── Uploads (cover photo → R2) ───────────────────────────
  static Future<String> uploadCover(File file) async {
    final req = http.MultipartRequest('POST', Uri.parse('$_admin/uploads/cover'))
      ..headers.addAll(_headers(json: false))
      ..files.add(await http.MultipartFile.fromPath('file', file.path));
    final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 120)));
    final decoded = jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, decoded?['message']?.toString() ?? 'فشل رفع الصورة');
    }
    return decoded['url'];
  }

  // ── Books ────────────────────────────────────────────────
  static Future<({List<AdminBook> books, int total})> books(
      {String? search, String? inventoryStatus, int page = 1, int pageSize = 30}) async {
    final data = await _send('GET', '$_admin/books', query: {
      if (search != null && search.isNotEmpty) 'search': search,
      if (inventoryStatus != null) 'inventoryStatus': inventoryStatus,
      'page': '$page',
      'pageSize': '$pageSize',
    });
    final list = data is List ? data : (data['books'] ?? data['items'] ?? []);
    final total = data is Map ? (data['total'] ?? (list as List).length) : (list as List).length;
    return (books: (list as List).map((e) => AdminBook.fromJson(e)).toList(), total: total as int);
  }

  static Future<AdminBook> createBook(Map<String, dynamic> data) async =>
      AdminBook.fromJson(await _send('POST', '$_admin/books', body: data));

  static Future<AdminBook> updateBook(String id, Map<String, dynamic> data) async =>
      AdminBook.fromJson(await _send('PATCH', '$_admin/books/$id', body: data));

  static Future<void> deleteBook(String id) => _send('DELETE', '$_admin/books/$id');

  // ── Catalog (categories/authors/publishers/countries) ────
  static Future<List<CatalogItem>> catalog(String resource) async =>
      ((await _send('GET', '$_admin/catalog/$resource')) as List).map((e) => CatalogItem.fromJson(e)).toList();

  static Future<void> createCatalog(String resource, String name) =>
      _send('POST', '$_admin/catalog/$resource', body: {'name': name});

  static Future<void> updateCatalog(String resource, String id, String name) =>
      _send('PATCH', '$_admin/catalog/$resource/$id', body: {'name': name});

  static Future<void> deleteCatalog(String resource, String id) => _send('DELETE', '$_admin/catalog/$resource/$id');

  // ── Academic tree ────────────────────────────────────────
  static Future<List<AcademicField>> academicTree() async =>
      ((await _send('GET', '$_admin/academic/tree')) as List).map((e) => AcademicField.fromJson(e)).toList();

  static Future<void> createField(String name) => _send('POST', '$_admin/academic/fields', body: {'name': name});
  static Future<void> updateField(String id, String name) => _send('PATCH', '$_admin/academic/fields/$id', body: {'name': name});
  static Future<void> deleteField(String id) => _send('DELETE', '$_admin/academic/fields/$id');
  static Future<void> createYear(String fieldId, String name) =>
      _send('POST', '$_admin/academic/years', body: {'fieldId': fieldId, 'name': name});
  static Future<void> updateYear(String id, String name) => _send('PATCH', '$_admin/academic/years/$id', body: {'name': name});
  static Future<void> deleteYear(String id) => _send('DELETE', '$_admin/academic/years/$id');
  static Future<void> createSubject(String yearId, String name) =>
      _send('POST', '$_admin/academic/subjects', body: {'yearId': yearId, 'name': name});
  static Future<void> updateSubject(String id, String name) => _send('PATCH', '$_admin/academic/subjects/$id', body: {'name': name});
  static Future<void> deleteSubject(String id) => _send('DELETE', '$_admin/academic/subjects/$id');

  // ── Orders ───────────────────────────────────────────────
  static Future<OrdersPage> orders({String? status, String? search, int page = 1, int pageSize = 20}) async =>
      OrdersPage.fromJson(await _send('GET', '$_admin/orders', query: {
        if (status != null) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
        'page': '$page',
        'pageSize': '$pageSize',
      }));

  static Future<AdminOrder> order(String id) async => AdminOrder.fromJson(await _send('GET', '$_admin/orders/$id'));

  static Future<AdminOrder> updateOrderStatus(String id, String status) async =>
      AdminOrder.fromJson(await _send('PATCH', '$_admin/orders/$id/status', body: {'status': status}));

  static Future<void> deleteOrder(String id) => _send('DELETE', '$_admin/orders/$id');

  static Future<AdminOrder> convertRequest(String requestId,
          {required List<Map<String, dynamic>> items, num shippingCost = 0, String? notes}) async =>
      AdminOrder.fromJson(await _send('POST', '$_admin/orders/from-request/$requestId',
          body: {'items': items, 'shippingCost': shippingCost, if (notes != null) 'notes': notes}));

  // ── Inventory ────────────────────────────────────────────
  static Future<List<AdminBook>> inventory({String? search, String? status, bool lowStock = false}) async {
    final data = await _send('GET', '$_admin/inventory', query: {
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null) 'status': status,
      if (lowStock) 'lowStock': 'true',
    });
    final list = data is List ? data : (data['items'] ?? data['books'] ?? []);
    return (list as List).map((e) => AdminBook.fromJson(e)).toList();
  }

  static Future<void> updateInventory(String bookId, {required String status, int? stock}) =>
      _send('PATCH', '$_admin/inventory/$bookId', body: {'status': status, 'stock': stock});

  // ── Requests (store-scoped, guarded) ─────────────────────
  static Future<({List<RequestLead> requests, Map<String, int> counts})> requests({String? status, String? search}) async {
    final data = await _send('GET', '$_store/requests', query: {
      if (status != null) 'status': status,
      if (search != null && search.isNotEmpty) 'search': search,
    });
    return (
      requests: (data['requests'] as List? ?? []).map((e) => RequestLead.fromJson(e)).toList(),
      counts: {for (final c in (data['counts'] as List? ?? [])) c['status'] as String: (c['_count'] ?? 0) as int},
    );
  }

  static Future<void> updateRequestStatus(String id, String status) =>
      _send('PATCH', '$_store/requests/$id/status', body: {'status': status});
}
