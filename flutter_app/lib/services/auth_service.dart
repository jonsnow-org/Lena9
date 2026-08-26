import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// يغلّف مصادقة Firebase الحقيقية — نفس حساب المستخدم الذي يسجّل دخوله
/// من الموقع تماماً (نفس مشروع Firebase)، فأي مستخدم مسجَّل بالفعل على
/// literium.ai.studio يدخل بنفس بياناته هنا دون أي حساب مزدوج.
class AuthService extends ChangeNotifier {
  final _auth = FirebaseAuth.instance;
  final _googleSignIn = GoogleSignIn();

  bool isInitializing = true;
  User? _user;
  String? lastError;

  User? get user => _user;
  bool get isLoggedIn => _user != null;

  AuthService() {
    _auth.authStateChanges().listen((user) {
      _user = user;
      isInitializing = false;
      notifyListeners();
    });
  }

  Future<bool> signInWithEmail(String email, String password) async {
    lastError = null;
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
      return true;
    } on FirebaseAuthException catch (e) {
      lastError = _arabicMessageFor(e.code);
      notifyListeners();
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    lastError = null;
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return false; // ألغى المستخدم بنفسه
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      await _auth.signInWithCredential(credential);
      return true;
    } catch (e) {
      lastError = 'تعذّر تسجيل الدخول عبر Google. حاول مرة أخرى.';
      notifyListeners();
      return false;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }

  /// توكن Firebase الحقيقي — نفس ما يرسله الموقع في ترويسة Authorization
  /// عند استدعاء endpoints الدفع في server.ts (verifyRequestAuth).
  Future<String?> getIdToken() => _user?.getIdToken() ?? Future.value(null);

  String _arabicMessageFor(String code) {
    switch (code) {
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      case 'too-many-requests':
        return 'محاولات كثيرة جداً. حاول لاحقاً.';
      default:
        return 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
    }
  }
}
