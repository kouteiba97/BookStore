import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elbayan_admin/api.dart';
import 'package:elbayan_admin/main.dart';

void main() {
  testWidgets('logged-out app lands on the RTL login screen', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await Auth.load();

    await tester.pumpWidget(const ElbayanAdminApp());
    await tester.pump();

    expect(find.text('لوحة التحكم'), findsOneWidget);
    expect(find.text('دخول'), findsOneWidget);

    final direction = Directionality.of(tester.element(find.text('دخول')));
    expect(direction, TextDirection.rtl);
  });
}
