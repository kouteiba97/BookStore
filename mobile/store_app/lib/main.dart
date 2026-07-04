import 'package:flutter/material.dart';
import 'screens/academic.dart';
import 'screens/home.dart';
import 'screens/search.dart';
import 'theme.dart';

void main() => runApp(const ElbayanStoreApp());

class ElbayanStoreApp extends StatelessWidget {
  const ElbayanStoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'مكتبة البيان',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      // Arabic-first, RTL everywhere — mirrors the web app.
      builder: (context, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: const _Shell(),
    );
  }
}

class _Shell extends StatefulWidget {
  const _Shell();
  @override
  State<_Shell> createState() => _ShellState();
}

class _ShellState extends State<_Shell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [HomeScreen(), AcademicFieldsScreen(), SearchScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.goldLight,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.school_outlined), selectedIcon: Icon(Icons.school), label: 'الأكاديمي'),
          NavigationDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search), label: 'البحث'),
        ],
      ),
    );
  }
}
