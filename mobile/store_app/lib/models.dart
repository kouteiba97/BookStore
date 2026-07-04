// Data models mirroring frontend/src/lib/types.ts.

class Category {
  final String id;
  final String name;
  const Category({required this.id, required this.name});
  factory Category.fromJson(Map<String, dynamic> j) => Category(id: j['id'], name: j['name']);
}

class Author {
  final String id;
  final String name;
  const Author({required this.id, required this.name});
  factory Author.fromJson(Map<String, dynamic> j) => Author(id: j['id'], name: j['name']);
}

class Publisher {
  final String id;
  final String name;
  const Publisher({required this.id, required this.name});
  factory Publisher.fromJson(Map<String, dynamic> j) => Publisher(id: j['id'], name: j['name']);
}

class Inventory {
  final String id;
  final int? stock;
  final String status; // available | on_request | rare
  const Inventory({required this.id, this.stock, required this.status});
  factory Inventory.fromJson(Map<String, dynamic> j) =>
      Inventory(id: j['id'], stock: j['stock'], status: j['status']);
}

class Book {
  final String id;
  final String title;
  final String? description;
  final int? year;
  final String? imageUrl;
  final num? price;
  final Inventory? inventory;
  final Category? category;
  final Author? author;
  final Publisher? publisher;

  const Book({
    required this.id,
    required this.title,
    this.description,
    this.year,
    this.imageUrl,
    this.price,
    this.inventory,
    this.category,
    this.author,
    this.publisher,
  });

  factory Book.fromJson(Map<String, dynamic> j) => Book(
        id: j['id'],
        title: j['title'],
        description: j['description'],
        year: j['year'],
        imageUrl: j['imageUrl'],
        price: j['price'] == null ? null : num.tryParse(j['price'].toString()),
        inventory: j['inventory'] == null ? null : Inventory.fromJson(j['inventory']),
        category: j['category'] == null ? null : Category.fromJson(j['category']),
        author: j['author'] == null ? null : Author.fromJson(j['author']),
        publisher: j['publisher'] == null ? null : Publisher.fromJson(j['publisher']),
      );
}

class Field {
  final String id;
  final String name;
  const Field({required this.id, required this.name});
  factory Field.fromJson(Map<String, dynamic> j) => Field(id: j['id'], name: j['name']);
}

class AcademicYear {
  final String id;
  final String name;
  const AcademicYear({required this.id, required this.name});
  factory AcademicYear.fromJson(Map<String, dynamic> j) => AcademicYear(id: j['id'], name: j['name']);
}

class Subject {
  final String id;
  final String name;
  const Subject({required this.id, required this.name});
  factory Subject.fromJson(Map<String, dynamic> j) => Subject(id: j['id'], name: j['name']);
}

class Suggestions {
  final List<Category> categories;
  final List<Author> authors;
  final List<({String id, String title})> books;
  const Suggestions({required this.categories, required this.authors, required this.books});
  factory Suggestions.fromJson(Map<String, dynamic> j) => Suggestions(
        categories: (j['categories'] as List? ?? []).map((e) => Category.fromJson(e)).toList(),
        authors: (j['authors'] as List? ?? []).map((e) => Author.fromJson(e)).toList(),
        books: (j['books'] as List? ?? []).map((e) => (id: e['id'] as String, title: e['title'] as String)).toList(),
      );
}
