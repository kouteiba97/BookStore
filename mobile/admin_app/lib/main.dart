import 'package:flutter/material.dart';
import 'api.dart';
import 'screens/academic.dart';
import 'screens/books.dart';
import 'screens/catalog.dart';
import 'screens/inventory.dart';
import 'screens/login.dart';
import 'screens/orders.dart';
import 'screens/overview.dart';
import 'screens/quick_add.dart';
import 'screens/requests.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Auth.load();
  runApp(const ElbayanAdminApp());
}

class ElbayanAdminApp extends StatelessWidget {
  const ElbayanAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'لوحة التحكم — مكتبة البيان',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
      home: Auth.isLoggedIn ? const AdminShell() : const LoginScreen(),
    );
  }
}

class AdminShell extends StatefulWidget {
  const AdminShell({super.key});
  @override
  State<AdminShell> createState() => _AdminShellState();
}

class _AdminShellState extends State<AdminShell> {
  int _index = 0;

  static const _titles = ['نظرة عامة', 'الطلبيات', 'طلبات الكتب', 'الكتب', 'المزيد'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandLogo(size: 26),
            const SizedBox(width: 8),
            Text(_titles[_index]),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'تسجيل الخروج',
            icon: const Icon(Icons.logout_rounded, size: 20),
            onPressed: () async {
              if (await confirmDialog(context, 'تسجيل الخروج؟')) {
                await Auth.logout();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
                }
              }
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          OverviewScreen(),
          OrdersScreen(),
          RequestsScreen(),
          BooksScreen(),
          _MoreScreen(),
        ],
      ),
      floatingActionButton: _index == 3
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.primaryForeground,
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const QuickAddScreen())),
              icon: const Icon(Icons.add),
              label: const Text('إضافة سريعة'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.goldLight,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'عامة'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'الطلبيات'),
          NavigationDestination(icon: Icon(Icons.mark_chat_unread_outlined), selectedIcon: Icon(Icons.mark_chat_unread), label: 'الطلبات'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: 'الكتب'),
          NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'المزيد'),
        ],
      ),
    );
  }
}

/// "More" tab — catalog, academic taxonomy, and inventory management.
class _MoreScreen extends StatelessWidget {
  const _MoreScreen();

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.category_outlined, 'الفهرس', 'التصنيفات، المؤلفون، دور النشر، البلدان', const CatalogScreen()),
      (Icons.school_outlined, 'الأكاديمي', 'التخصصات ← السنوات ← المواد', const AcademicScreen()),
      (Icons.inventory_2_outlined, 'المخزون', 'حالة التوفر والكميات', const InventoryScreen()),
      (Icons.add_box_outlined, 'إضافة سريعة', 'إدخال كتاب جديد مع صورة الغلاف', const QuickAddScreen()),
    ];
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final (icon, title, subtitle, screen) = items[i];
        return Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen)),
            leading: Container(
              width: 42,
              height: 42,
              decoration:
                  BoxDecoration(color: AppColors.goldLight.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: const Color(0xFF8A6620), size: 22),
            ),
            title: Text(title, style: heading(size: 17)),
            subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.mutedForeground),
          ),
        );
      },
    );
  }
}
