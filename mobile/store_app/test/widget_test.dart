import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:elbayan_store/main.dart';

void main() {
  testWidgets('app renders the RTL shell with bottom navigation', (tester) async {
    await tester.pumpWidget(const ElbayanStoreApp());
    await tester.pump();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('الرئيسية'), findsOneWidget);
    expect(find.text('الأكاديمي'), findsOneWidget);
    expect(find.text('البحث'), findsOneWidget);

    // Everything must render right-to-left.
    final direction = Directionality.of(tester.element(find.byType(NavigationBar)));
    expect(direction, TextDirection.rtl);
  });
}
