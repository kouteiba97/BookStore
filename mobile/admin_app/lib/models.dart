// Data models mirroring admin/src/lib/admin-types.ts.

num _num(dynamic v) => v == null ? 0 : (num.tryParse(v.toString()) ?? 0);

class CatalogItem {
  final String id;
  final String name;
  final String? description;
  final int booksCount;
  const CatalogItem({required this.id, required this.name, this.description, required this.booksCount});
  factory CatalogItem.fromJson(Map<String, dynamic> j) => CatalogItem(
      id: j['id'], name: j['name'], description: j['description'], booksCount: j['booksCount'] ?? j['_count']?['books'] ?? 0);
}

class AdminBook {
  final String id;
  final String title;
  final String? description;
  final int? year;
  final num? price;
  final String? imageUrl;
  final String? categoryId;
  final ({String id, String name})? category;
  final ({String id, String name})? author;
  final ({String id, String name})? publisher;
  final ({String id, String name})? country;
  final AdminInventory? inventory;
  final String createdAt;

  const AdminBook({
    required this.id,
    required this.title,
    this.description,
    this.year,
    this.price,
    this.imageUrl,
    this.categoryId,
    this.category,
    this.author,
    this.publisher,
    this.country,
    this.inventory,
    required this.createdAt,
  });

  static ({String id, String name})? _ref(dynamic j) =>
      j == null ? null : (id: j['id'] as String, name: j['name'] as String);

  factory AdminBook.fromJson(Map<String, dynamic> j) => AdminBook(
        id: j['id'],
        title: j['title'],
        description: j['description'],
        year: j['year'],
        price: j['price'] == null ? null : _num(j['price']),
        imageUrl: j['imageUrl'],
        categoryId: j['categoryId'],
        category: _ref(j['category']),
        author: _ref(j['author']),
        publisher: _ref(j['publisher']),
        country: _ref(j['country']),
        inventory: j['inventory'] == null ? null : AdminInventory.fromJson(j['inventory']),
        createdAt: j['createdAt'] ?? '',
      );
}

class AdminInventory {
  final String id;
  final int? stock;
  final String status; // available | on_request | rare
  const AdminInventory({required this.id, this.stock, required this.status});
  factory AdminInventory.fromJson(Map<String, dynamic> j) =>
      AdminInventory(id: j['id'], stock: j['stock'], status: j['status']);
}

class OrderItem {
  final String id;
  final String bookId;
  final String bookTitle;
  final num unitPrice;
  final int quantity;
  final String? bookImageUrl;
  const OrderItem(
      {required this.id, required this.bookId, required this.bookTitle, required this.unitPrice, required this.quantity, this.bookImageUrl});
  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        id: j['id'],
        bookId: j['bookId'],
        bookTitle: j['bookTitle'],
        unitPrice: _num(j['unitPrice']),
        quantity: j['quantity'],
        bookImageUrl: j['book']?['imageUrl'],
      );
}

class AdminOrder {
  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final String wilaya;
  final String address;
  final String status; // pending|confirmed|shipped|delivered|cancelled
  final num subtotal;
  final num shippingCost;
  final num total;
  final String? notes;
  final List<OrderItem> items;
  final String createdAt;

  const AdminOrder({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.wilaya,
    required this.address,
    required this.status,
    required this.subtotal,
    required this.shippingCost,
    required this.total,
    this.notes,
    required this.items,
    required this.createdAt,
  });

  String get customer => '$firstName $lastName';

  factory AdminOrder.fromJson(Map<String, dynamic> j) => AdminOrder(
        id: j['id'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        phone: j['phone'],
        wilaya: j['wilaya'],
        address: j['address'] ?? '',
        status: j['status'],
        subtotal: _num(j['subtotal']),
        shippingCost: _num(j['shippingCost']),
        total: _num(j['total']),
        notes: j['notes'],
        items: (j['items'] as List? ?? []).map((e) => OrderItem.fromJson(e)).toList(),
        createdAt: j['createdAt'] ?? '',
      );
}

class OrdersPage {
  final List<AdminOrder> orders;
  final int total;
  final num totalRevenue;
  final Map<String, int> counts;
  const OrdersPage({required this.orders, required this.total, required this.totalRevenue, required this.counts});
  factory OrdersPage.fromJson(Map<String, dynamic> j) => OrdersPage(
        orders: (j['orders'] as List? ?? []).map((e) => AdminOrder.fromJson(e)).toList(),
        total: j['total'] ?? 0,
        totalRevenue: _num(j['totalRevenue']),
        counts: {
          for (final c in (j['counts'] as List? ?? [])) c['status'] as String: (c['_count'] ?? 0) as int
        },
      );
}

class RequestLead {
  final String id;
  final String firstName;
  final String lastName;
  final String phone;
  final String wilaya;
  final String address;
  final String? bookId;
  final String bookName;
  final String status; // pending | contacted | done
  final String? convertedOrderId;
  final String createdAt;

  const RequestLead({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.phone,
    required this.wilaya,
    required this.address,
    this.bookId,
    required this.bookName,
    required this.status,
    this.convertedOrderId,
    required this.createdAt,
  });

  String get customer => '$firstName $lastName';

  factory RequestLead.fromJson(Map<String, dynamic> j) => RequestLead(
        id: j['id'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        phone: j['phone'],
        wilaya: j['wilaya'] ?? '',
        address: j['address'] ?? '',
        bookId: j['bookId'],
        bookName: j['bookName'] ?? '',
        status: j['status'],
        convertedOrderId: j['convertedOrderId'],
        createdAt: j['createdAt'] ?? '',
      );
}

class StatsOverview {
  final int booksCount;
  final int categoriesCount;
  final int authorsCount;
  final num totalRevenue;
  final int totalRequests;
  final int totalOrders;
  final num conversionRate;
  final int lowStockCount;
  final Map<String, int> requestsByStatus;
  final Map<String, int> ordersByStatus;
  final List<({String title, int quantity})> topBooks;
  final List<({String id, String name, num total, String status})> recentOrders;
  final List<({String id, String name, String bookName, String status})> recentRequests;

  const StatsOverview({
    required this.booksCount,
    required this.categoriesCount,
    required this.authorsCount,
    required this.totalRevenue,
    required this.totalRequests,
    required this.totalOrders,
    required this.conversionRate,
    required this.lowStockCount,
    required this.requestsByStatus,
    required this.ordersByStatus,
    required this.topBooks,
    required this.recentOrders,
    required this.recentRequests,
  });

  factory StatsOverview.fromJson(Map<String, dynamic> j) {
    final k = j['kpis'] ?? {};
    Map<String, int> byStatus(List? l) =>
        {for (final c in l ?? []) c['status'] as String: (c['_count'] ?? 0) as int};
    return StatsOverview(
      booksCount: k['booksCount'] ?? 0,
      categoriesCount: k['categoriesCount'] ?? 0,
      authorsCount: k['authorsCount'] ?? 0,
      totalRevenue: _num(k['totalRevenue']),
      totalRequests: k['totalRequests'] ?? 0,
      totalOrders: k['totalOrders'] ?? 0,
      conversionRate: _num(k['conversionRate']),
      lowStockCount: k['lowStockCount'] ?? 0,
      requestsByStatus: byStatus(j['requestsByStatus']),
      ordersByStatus: byStatus(j['ordersByStatus']),
      topBooks: [
        for (final t in j['topBooks'] ?? []) (title: t['title'] as String, quantity: (t['quantity'] ?? 0) as int)
      ],
      recentOrders: [
        for (final o in j['recentOrders'] ?? [])
          (id: o['id'] as String, name: '${o['firstName']} ${o['lastName']}', total: _num(o['total']), status: o['status'] as String)
      ],
      recentRequests: [
        for (final r in j['recentRequests'] ?? [])
          (id: r['id'] as String, name: '${r['firstName']} ${r['lastName']}', bookName: (r['bookName'] ?? '') as String, status: r['status'] as String)
      ],
    );
  }
}

class AcademicField {
  final String id;
  final String name;
  final List<AcademicYearNode> years;
  const AcademicField({required this.id, required this.name, required this.years});
  factory AcademicField.fromJson(Map<String, dynamic> j) => AcademicField(
      id: j['id'], name: j['name'], years: (j['years'] as List? ?? []).map((e) => AcademicYearNode.fromJson(e)).toList());
}

class AcademicYearNode {
  final String id;
  final String name;
  final List<AcademicSubjectNode> subjects;
  const AcademicYearNode({required this.id, required this.name, required this.subjects});
  factory AcademicYearNode.fromJson(Map<String, dynamic> j) => AcademicYearNode(
      id: j['id'], name: j['name'], subjects: (j['subjects'] as List? ?? []).map((e) => AcademicSubjectNode.fromJson(e)).toList());
}

class AcademicSubjectNode {
  final String id;
  final String name;
  final int booksCount;
  const AcademicSubjectNode({required this.id, required this.name, required this.booksCount});
  factory AcademicSubjectNode.fromJson(Map<String, dynamic> j) =>
      AcademicSubjectNode(id: j['id'], name: j['name'], booksCount: j['_count']?['books'] ?? 0);
}
