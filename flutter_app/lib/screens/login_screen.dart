import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;

  Future<void> _submitEmailLogin() async {
    final auth = context.read<AuthService>();
    setState(() => _isSubmitting = true);
    await auth.signInWithEmail(
      _emailController.text.trim(),
      _passwordController.text,
    );
    if (mounted) setState(() => _isSubmitting = false);
  }

  Future<void> _submitGoogleLogin() async {
    final auth = context.read<AuthService>();
    setState(() => _isSubmitting = true);
    await auth.signInWithGoogle();
    if (mounted) setState(() => _isSubmitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 48),
                Text(
                  'ليتيريوم',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'سجّل دخولك بنفس حسابك على الموقع',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(
                    labelText: 'البريد الإلكتروني',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(
                    labelText: 'كلمة المرور',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (auth.lastError != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    auth.lastError!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _submitEmailLogin,
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('تسجيل الدخول'),
                  ),
                ),
                const SizedBox(height: 12),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text('أو'),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isSubmitting ? null : _submitGoogleLogin,
                    icon: const Icon(Icons.g_mobiledata, size: 28),
                    label: const Text('المتابعة عبر Google'),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
