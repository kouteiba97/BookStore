import 'package:flutter/material.dart';
import '../api.dart';
import '../main.dart';
import '../theme.dart';
import '../widgets.dart';

/// Mirrors admin/src/pages/login.tsx — shared password → 30-day JWT.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _password = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;

  Future<void> _login() async {
    final password = _password.text;
    if (password.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await Api.login(password);
      if (mounted) {
        Navigator.of(context)
            .pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AdminShell()), (_) => false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        showError(context, e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: BrandLogo(size: 72)),
                    const SizedBox(height: 14),
                    Text('مكتبة البيان', textAlign: TextAlign.center, style: heading(size: 24)),
                    const Text('لوحة التحكم',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.mutedForeground, fontSize: 13)),
                    const SizedBox(height: 24),
                    const Text('كلمة المرور',
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.mutedForeground)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _login(),
                      decoration: InputDecoration(
                        hintText: '••••••••',
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    ElevatedButton(
                      onPressed: _submitting ? null : _login,
                      child: _submitting
                          ? const SizedBox(
                              width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('دخول'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
