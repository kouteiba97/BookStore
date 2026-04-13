export interface Book {
  id: string;
  title: string;
  titleNormalized: string | null;
  description: string | null;
  year: number | null;
  imageUrl: string | null;
  price?: number | null;
  inventory: Inventory | null;
  category: Category | null;
  author: Author | null;
  publisher: Publisher | null;
}

export interface Inventory {
  id: string;
  stock: number | null;
  status: "available" | "on_request" | "rare";
}

export interface Category {
  id: string;
  name: string;
}

export interface Author {
  id: string;
  name: string;
}

export interface Publisher {
  id: string;
  name: string;
}

export interface Field {
  id: string;
  name: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  fieldId: string;
}

export interface Subject {
  id: string;
  name: string;
  yearId: string;
}

export interface AutocompleteItem {
  id: string;
  title: string;
}

export interface Suggestions {
  categories: Category[];
  authors: Author[];
  books: AutocompleteItem[];
}
