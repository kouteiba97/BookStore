import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Warm library palette — ported from the web app's CSS variables
/// (frontend/src/index.css). Keep both apps' copies identical.
abstract class AppColors {
  static const background = Color(0xFFF7F3EC);
  static const foreground = Color(0xFF29231C);
  static const card = Color(0xFFFDFCF9);
  static const primary = Color(0xFF254A39); // deep library green (logo disc)
  static const primaryForeground = Color(0xFFF8F4E9);
  static const secondary = Color(0xFFEFE7D9);
  static const secondaryForeground = Color(0xFF4A4136);
  static const muted = Color(0xFFF0EBE1);
  static const mutedForeground = Color(0xFF6E665A);
  static const accent = Color(0xFFF1EADC);
  static const destructive = Color(0xFFB93C2B);
  static const border = Color(0xFFE5DFD2);
  static const gold = Color(0xFFC89C4E);
  static const goldLight = Color(0xFFF0E4C8);
  static const success = Color(0xFF2E7D52);
}

/// Amiri for headings/brand, Cairo for body — same pairing as the web.
TextStyle heading({double size = 20, FontWeight weight = FontWeight.bold, Color color = AppColors.foreground}) =>
    GoogleFonts.amiri(fontSize: size, fontWeight: weight, color: color, height: 1.5);

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      primary: AppColors.primary,
      onPrimary: AppColors.primaryForeground,
      secondary: AppColors.gold,
      onSecondary: AppColors.foreground,
      surface: AppColors.card,
      onSurface: AppColors.foreground,
      error: AppColors.destructive,
    ),
    scaffoldBackgroundColor: AppColors.background,
  );

  final cairo = GoogleFonts.cairoTextTheme(base.textTheme).apply(
    bodyColor: AppColors.foreground,
    displayColor: AppColors.foreground,
  );

  return base.copyWith(
    textTheme: cairo,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.primary,
      foregroundColor: AppColors.primaryForeground,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: heading(size: 20, color: AppColors.primaryForeground),
    ),
    cardTheme: const CardThemeData(
      color: AppColors.card,
      elevation: 1,
      surfaceTintColor: Colors.transparent,
      shadowColor: Color(0x1A4A4136),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
        side: BorderSide(color: AppColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.gold, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.primaryForeground,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.cairo(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: const BorderSide(color: AppColors.border),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: GoogleFonts.cairo(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: AppColors.secondary,
      side: const BorderSide(color: AppColors.border),
      labelStyle: GoogleFonts.cairo(color: AppColors.secondaryForeground, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.foreground,
      contentTextStyle: GoogleFonts.cairo(color: Colors.white),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
