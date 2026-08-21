import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { User, UserRole, Article, AdCampaign, Transaction, AppNotification, FraudFlag } from './types';
import { DEFAULT_FREE_DAILY_LIMIT } from './utils/aiQuota';

// The platform owner's account. This exact email always resolves to the
// 'admin' role (both here and in firestore.rules) — it can never be spoofed
// by a client since it comes from the verified Firebase Auth token, not from
// any user-editable field.
export const OWNER_ADMIN_EMAIL = 'brnardtsho@gmail.com';

// Provided Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDHjT0AmvF_wQPrRAu7dSX4EfWWqxMh4c0",
  authDomain: "literium.firebaseapp.com",
  projectId: "literium",
  storageBucket: "literium.firebasestorage.app",
  messagingSenderId: "417982388041",
  appId: "1:417982388041:web:f105a93f60c8fe703d6c98",
  measurementId: "G-66YRRR0CB4"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase App Check with reCAPTCHA v3 before other Firebase services
export let appCheck: AppCheck | undefined;
if (typeof window !== 'undefined') {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LeC3YwtAAAAACGI8H0jDebhQ58hai37jaW_5pzV'),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    console.warn('Firebase App Check initialization warning:', error);
  }
}

export const auth = getAuth(app);

// تخزين الجلسة بشكل متدرّج: يحاول أولاً browserLocalPersistence (يبقى بعد
// إغلاق المتصفح)، فإن فشل (بعض متصفحات الجوال تُغلق IndexedDB عند تعليق
// التبويب) يتدرّج إلى session ثم إلى الذاكرة فقط — بدل ترك الإعداد
// الافتراضي عرضة لخطأ "Database is closing/hidden" بلا أي احتياط.
setPersistence(auth, browserLocalPersistence).catch(() => {
  setPersistence(auth, browserSessionPersistence).catch(() => {
    setPersistence(auth, inMemoryPersistence).catch((err) => {
      console.error('تعذر ضبط أي وضعية لتخزين جلسة الدخول:', err);
    });
  });
});
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// signInWithPopup is unreliable on mobile browsers (popup blocking, third-party
// cookie partitioning). We use signInWithRedirect on mobile and popup on desktop.
const isMobileBrowser = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);

// The role the user intended to sign up as. Needed because signInWithRedirect
// reloads the page — any in-memory state is lost, so we persist this across
// the redirect and consume it once in the central auth listener (App.tsx).
const PENDING_ROLE_KEY = 'literium_pending_signup_role';

export function getAndClearPendingRole(): UserRole | null {
  const role = localStorage.getItem(PENDING_ROLE_KEY) as UserRole | null;
  localStorage.removeItem(PENDING_ROLE_KEY);
  return role;
}

// Maps Firebase Auth & Firestore error codes to clear Arabic messages for the UI.
export function getAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول بدلاً من إنشاء حساب جديد.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف على الأقل.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'لا يوجد حساب بهذا البريد الإلكتروني، أو كلمة المرور غير صحيحة.';
    case 'auth/wrong-password':
      return 'كلمة المرور غير صحيحة.';
    case 'auth/account-exists-with-different-credential':
      return 'هذا البريد مسجّل مسبقاً بطريقة دخول مختلفة (بريد وكلمة مرور). سجّل الدخول بكلمة المرور بدل Google.';
    case 'auth/too-many-requests':
      return 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.';
    case 'auth/unauthorized-domain':
      return 'هذا النطاق غير مصرّح به في إعدادات Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بهذه الطريقة غير مفعّل حالياً في إعدادات المشروع.';
    case 'auth/cancelled-popup-request':
    case 'auth/operation-not-supported-in-this-environment':
      return 'تعذّر فتح نافذة تسجيل الدخول في هذا المتصفح. تتم إعادة المحاولة تلقائياً بطريقة أخرى.';
    case 'auth/internal-error':
      return 'حدث خطأ داخلي من خدمة تسجيل الدخول. حاول مرة أخرى خلال لحظات.';
    case 'permission-denied':
      return 'تم رفض إذن حفظ البيانات في قاعدة البيانات Firestore. تأكد من إعدادات الصلاحيات.';
    case 'unavailable':
      return 'خدمة قاعدة البيانات غير متاحة حالياً. تحقق من اتصال الإنترنت وحاول مجدداً.';
    default: {
      // خطأ تقني من نظام تخزين المتصفح الداخلي (IndexedDB) — يحدث غالباً
      // عند فتح أكثر من تبويب لنفس الموقع بنفس الوقت (تنافس على نفس قاعدة
      // بيانات المصادقة المحلية)، أو أثناء إعادة تحميل الصفحة. مؤقت عادةً.
      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      if (/closing|database connection|indexeddb/i.test(rawMessage)) {
        return 'حدث تعارض مؤقت في تخزين المتصفح — على الأغلب بسبب فتح أكثر من تبويب لنفس الموقع. أغلق التبويبات الأخرى وأعد المحاولة.';
      }
      if (rawMessage && rawMessage.length < 120) {
        return rawMessage;
      }
      return code
        ? `حدث خطأ غير متوقع (${code}). حاول مرة أخرى.`
        : 'حدث خطأ غير متوقع أثناء العملية. حاول مرة أخرى.';
    }
  }
}

/**
 * تعيد تنفيذ دالة async مرة واحدة إذا فشلت بخطأ IndexedDB مؤقت (تعارض
 * تبويبات/إعادة تحميل)، بدل إظهار فشل فوري لمستخدم قد ينجح بمجرد
 * إعادة محاولة سريعة تلقائية.
 */
async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const msg = typeof error?.message === 'string' ? error.message : '';
    if (/closing|database connection|indexeddb/i.test(msg)) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return await fn();
    }
    throw error;
  }
}

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// ----------------------------------------------------
// Firestore User Operations
// ----------------------------------------------------

export async function fetchUserFromFirestore(uid: string): Promise<User | null> {
  const userDocRef = doc(db, 'users', uid);
  const snap = await getDoc(userDocRef);
  if (snap.exists()) {
    const data = snap.data();
    const isOwner = (data.email || auth.currentUser?.email || '').toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase();
    const resolvedRole: UserRole = isOwner ? 'admin' : ((data.role as UserRole) || 'reader');

    return {
      id: snap.id,
      email: data.email || auth.currentUser?.email || '',
      fullName: data.displayName || data.name || data.fullName || 'مستخدم ليتيريوم',
      username: data.username || (data.email ? data.email.split('@')[0] : `user_${uid.slice(0, 5)}`),
      avatarUrl: data.avatarUrl || data.photoURL || data.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
      role: resolvedRole,
      bio: data.bio || '',
      penName: data.penName || undefined,
      companyName: data.companyName || undefined,
      companyIndustry: data.companyIndustry || undefined,
      companyWebsite: data.companyWebsite || undefined,
      specialties: Array.isArray(data.specialties) ? data.specialties : undefined,
      isVerified: data.isVerified ?? (resolvedRole === 'admin'),
      followersCount: data.followersCount || 0,
      followingCount: data.followingCount || 0,
      articlesCount: data.articlesCount || 0,
      totalViews: data.totalViews || 0,
      totalEarnings: Number(data.totalEarnings ?? (data.walletBalance ?? 0)),
      monthlyEarnings: data.monthlyEarnings || 0,
      // ⚠️ كانت هذه الحقول المالية الأربعة غائبة تماماً عن الكائن المُعاد
      // هنا رغم وجودها فعلياً في مستند Firestore — فيبدو للمستخدم أن رصيده
      // "اختفى" (يعود 0 عبر ?? 0 في كل مكان يقرأها) بمجرد أي إعادة تحميل
      // أو إعادة مزامنة، رغم أن المبلغ الحقيقي محفوظ بأمان في القاعدة.
      walletBalance: Number(data.walletBalance ?? 0),
      availableBalance: Number(data.availableBalance ?? 0),
      pendingEarnings: Number(data.pendingEarnings ?? 0),
      lifetimeEarnings: Number(data.lifetimeEarnings ?? (data.totalEarnings ?? 0)),
      joinedDate: data.createdAt ? new Date(data.createdAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) : 'حديثاً',
      createdAt: data.createdAt || undefined,
      aiQuota: data.aiQuota || {
        freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
        usedToday: 0,
        lastResetTime: new Date().toISOString(),
        isSubscriber: false,
        plan: 'none'
      }
    };
  }
  // المستند غير موجود فعلاً (حساب جديد حقاً) — هذه الحالة الوحيدة التي
  // يصح فيها إرجاع null. أي خطأ حقيقي أثناء القراءة (صلاحيات، شبكة، ...)
  // يُرمى للأعلى بدل إخفائه، حتى لا يُفهَم خطأً على أنه "الحساب غير موجود"
  // فيحاول الكود إنشاء حساب من الصفر فوق حساب حقيقي له رصيد وأرباح —
  // وهو بالضبط ما كان يسبب رفض قاعدة البيانات لتسجيل دخول حسابَي المالك
  // والكاتب سابقاً (محاولة تصفير رصيد حقيقي غير صفري).
  return null;
}

export async function createOrUpdateUserDoc(
  fbUser: FirebaseUser,
  roleOverride?: UserRole,
  extraProfileData?: Partial<User>
): Promise<User> {
  const uid = fbUser.uid;
  const userRef = doc(db, 'users', uid);
  const userEmail = (fbUser.email || extraProfileData?.email || '').toLowerCase();
  const isOwner = userEmail === OWNER_ADMIN_EMAIL.toLowerCase();

  const safeRole: UserRole = isOwner
    ? 'admin'
    : (roleOverride === 'writer' || roleOverride === 'advertiser' ? roleOverride : 'reader');

  const defaultBio =
    safeRole === 'writer'
      ? 'كاتب وباحث في منصة ليتيريوم'
      : safeRole === 'advertiser'
      ? 'شركة رائدة في تقديم الحلول والخدمات الرقمية للمجتمع.'
      : 'قارئ مهتم بالفكر والأدب والإعلانات';

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      const displayName =
        extraProfileData?.fullName ||
        fbUser.displayName ||
        (fbUser.email ? fbUser.email.split('@')[0] : 'مستخدم ليتيريوم');
      const avatarUrl =
        extraProfileData?.avatarUrl ||
        fbUser.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
      const username =
        extraProfileData?.username ||
        (fbUser.email ? fbUser.email.split('@')[0] : `user_${uid.slice(0, 6)}`);

      // Construct object with zero `undefined` values to satisfy Firestore SDK requirements
      const newUserDocData: Record<string, any> = {
        uid: uid,
        email: fbUser.email || extraProfileData?.email || '',
        username: username,
        displayName: displayName,
        name: displayName,
        role: safeRole,
        avatarUrl: avatarUrl,
        photoURL: avatarUrl,
        coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
        walletBalance: 0,
        availableBalance: 0,
        pendingEarnings: 0,
        lifetimeEarnings: 0,
        totalEarnings: 0,
        isVerified: safeRole === 'admin',
        createdAt: new Date().toISOString(),
        bio: extraProfileData?.bio || defaultBio,
        followersCount: 0,
        followingCount: 0,
        articlesCount: 0,
        totalViews: 0
      };

      if (extraProfileData?.penName || safeRole === 'writer') {
        newUserDocData.penName = extraProfileData?.penName || displayName;
      }
      if (extraProfileData?.companyName || safeRole === 'advertiser') {
        newUserDocData.companyName = extraProfileData?.companyName || displayName;
      }
      if (extraProfileData?.companyIndustry) {
        newUserDocData.companyIndustry = extraProfileData.companyIndustry;
      }
      if (extraProfileData?.companyWebsite) {
        newUserDocData.companyWebsite = extraProfileData.companyWebsite;
      }
      if (extraProfileData?.specialties && Array.isArray(extraProfileData.specialties) && extraProfileData.specialties.length > 0) {
        newUserDocData.specialties = extraProfileData.specialties;
      }

      await setDoc(userRef, newUserDocData, { merge: true });

      return {
        id: uid,
        email: newUserDocData.email,
        fullName: displayName,
        username: newUserDocData.username,
        avatarUrl: newUserDocData.avatarUrl,
        coverUrl: newUserDocData.coverUrl,
        role: safeRole,
        bio: newUserDocData.bio,
        penName: newUserDocData.penName,
        companyName: newUserDocData.companyName,
        companyIndustry: newUserDocData.companyIndustry,
        companyWebsite: newUserDocData.companyWebsite,
        specialties: newUserDocData.specialties,
        isVerified: newUserDocData.isVerified,
        followersCount: 0,
        followingCount: 0,
        articlesCount: 0,
        totalViews: 0,
        totalEarnings: 0,
        monthlyEarnings: 0,
        walletBalance: 0,
        availableBalance: 0,
        pendingEarnings: 0,
        lifetimeEarnings: 0,
        joinedDate: 'اليوم',
        createdAt: newUserDocData.createdAt,
        aiQuota: {
          freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
          usedToday: 0,
          lastResetTime: new Date().toISOString(),
          isSubscriber: false,
          plan: 'none'
        }
      };
    } else {
      const currentData = existingSnap.data();
      let activeRole = (currentData.role || 'reader') as UserRole;

      if (isOwner) {
        if (activeRole !== 'admin') {
          await updateDoc(userRef, { role: 'admin' });
          activeRole = 'admin';
        }
      } else if (
        roleOverride &&
        (roleOverride === 'writer' || roleOverride === 'reader' || roleOverride === 'advertiser') &&
        roleOverride !== activeRole
      ) {
        await updateDoc(userRef, { role: roleOverride });
        activeRole = roleOverride;
      }

      const balance = Number(currentData.walletBalance ?? (currentData.totalEarnings ?? 0));

      return {
        id: uid,
        email: currentData.email || fbUser.email || '',
        fullName: currentData.displayName || currentData.name || currentData.fullName || fbUser.displayName || 'مستخدم ليتيريوم',
        username: currentData.username || (currentData.email ? currentData.email.split('@')[0] : `user_${uid.slice(0, 5)}`),
        avatarUrl: currentData.avatarUrl || currentData.photoURL || fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
        coverUrl: currentData.coverUrl || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
        role: activeRole,
        bio: currentData.bio || '',
        penName: currentData.penName,
        companyName: currentData.companyName,
        companyIndustry: currentData.companyIndustry,
        companyWebsite: currentData.companyWebsite,
        specialties: currentData.specialties,
        isVerified: currentData.isVerified ?? (activeRole === 'admin'),
        followersCount: currentData.followersCount || 0,
        followingCount: currentData.followingCount || 0,
        articlesCount: currentData.articlesCount || 0,
        totalViews: currentData.totalViews || 0,
        totalEarnings: balance,
        monthlyEarnings: currentData.monthlyEarnings || 0,
        walletBalance: Number(currentData.walletBalance ?? 0),
        availableBalance: Number(currentData.availableBalance ?? 0),
        pendingEarnings: Number(currentData.pendingEarnings ?? 0),
        lifetimeEarnings: Number(currentData.lifetimeEarnings ?? balance),
        joinedDate: currentData.createdAt ? new Date(currentData.createdAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) : 'سابقاً',
        createdAt: currentData.createdAt || undefined,
        aiQuota: currentData.aiQuota || {
          freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
          usedToday: 0,
          lastResetTime: new Date().toISOString(),
          isSubscriber: false,
          plan: 'none'
        }
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    console.error('Failed to create or update Firestore user document:', error);
    throw error;
  }
}

// ----------------------------------------------------
// Real Google Authentication
// ----------------------------------------------------

export async function signInWithGoogle(desiredRole: UserRole = 'reader'): Promise<User | null> {
  localStorage.setItem(PENDING_ROLE_KEY, desiredRole);

  // signInWithPopup is unreliable in mobile browsers and in embedded/sandboxed
  // webviews (like the one AI Studio previews run in): the popup can get
  // closed, blocked, or silently fail with an error code we don't recognize
  // (auth/cancelled-popup-request, auth/operation-not-supported-in-this-environment,
  // etc.) even though Firebase may have already registered the account.
  // On mobile we go straight to the redirect flow instead of trying popup
  // first — this is far more reliable and is Google's own recommendation
  // for mobile web.
  if (isMobileBrowser()) {
    try {
      await signInWithRedirect(auth, googleProvider);
      return null; // page will navigate away; completeRedirectSignIn() picks it up after reload
    } catch (redirectError) {
      localStorage.removeItem(PENDING_ROLE_KEY);
      console.error('Google Redirect Sign In Error:', redirectError);
      throw redirectError;
    }
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const user = await createOrUpdateUserDoc(result.user, desiredRole);
      localStorage.removeItem(PENDING_ROLE_KEY);
      return user;
    }
    return null;
  } catch (error: any) {
    // Any popup-related failure on desktop falls back to the redirect flow
    // instead of only two very specific error codes.
    const popupFailureCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
      'auth/internal-error'
    ];
    if (popupFailureCodes.includes(error?.code)) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError) {
        localStorage.removeItem(PENDING_ROLE_KEY);
        console.error('Google Redirect Sign In Error:', redirectError);
        throw redirectError;
      }
    }
    localStorage.removeItem(PENDING_ROLE_KEY);
    console.error('Google Sign In Error:', error);
    throw error;
  }
}

// Must be called once on app startup to finish a signInWithRedirect flow.
export async function completeRedirectSignIn(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const pendingRole = getAndClearPendingRole() || 'reader';
      return await createOrUpdateUserDoc(result.user, pendingRole);
    }
    return null;
  } catch (error) {
    console.error('Redirect Sign-In completion error:', error);
    localStorage.removeItem(PENDING_ROLE_KEY);
    return null;
  }
}

// ----------------------------------------------------
// Real Email/Password Authentication
// ----------------------------------------------------

export async function registerWithEmail(
  email: string,
  password: string,
  role: UserRole,
  profileData: Partial<User>
): Promise<User> {
  // createUserWithEmailAndPassword fires the global onAuthStateChanged
  // listener (in App.tsx) essentially immediately — which races against
  // this function's own createOrUpdateUserDoc call below and may create
  // the Firestore document itself first. That listener falls back to
  // whatever role is stashed under PENDING_ROLE_KEY (used by the Google
  // sign-in flow) — so without setting it here too, an email/password
  // signup could get silently created as 'reader' regardless of the role
  // actually chosen on the form. Stashing the same key here means both
  // sides of the race agree on the correct role either way.
  localStorage.setItem(PENDING_ROLE_KEY, role);
  try {
    const createAccount = async (): Promise<FirebaseUser> => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (profileData.fullName) {
        await updateProfile(cred.user, { displayName: profileData.fullName });
      }
      return cred.user;
    };

    let fbUser: FirebaseUser;
    try {
      fbUser = await createAccount();
    } catch (error: any) {
      const msg = typeof error?.message === 'string' ? error.message : '';
      const isTransient = /closing|database connection|indexeddb/i.test(msg);
      if (!isTransient) throw error;

      await new Promise((resolve) => setTimeout(resolve, 600));
      try {
        fbUser = await createAccount();
      } catch (retryError: any) {
        // ⚠️ الخطأ المؤقت الأصلي (IndexedDB) قد يصل بعد أن يكون الحساب
        // أُنشئ فعلياً على خوادم Firebase — فتفشل محاولة إعادة الإنشاء
        // بـ auth/email-already-in-use رغم أن التسجيل الأول نجح حقيقةً.
        // بما أننا نحن من زوّدنا كلمة المرور هذه للتو ضمن نفس محاولة
        // التسجيل، الاحتمال الأقرب بكثير أنه حسابنا نفسه لا حساب آخر
        // مصادف لنفس البريد — فنكمل بتسجيل الدخول به بدل عرض رسالة
        // "البريد مستخدم من قبل" المضلّلة لمستخدم يسجّل لأول مرة.
        if (retryError?.code === 'auth/email-already-in-use') {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          fbUser = cred.user;
        } else {
          throw retryError;
        }
      }
    }

    return await createOrUpdateUserDoc(fbUser, role, profileData);
  } finally {
    localStorage.removeItem(PENDING_ROLE_KEY);
  }
}

export async function loginWithEmail(email: string, password: string): Promise<User | null> {
  return withTransientRetry(async () => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    let user = await fetchUserFromFirestore(cred.user.uid);
    if (!user) {
      user = await createOrUpdateUserDoc(cred.user);
    }
    return user;
  });
}

export async function logOut(): Promise<void> {
  try {
    await fbSignOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
  }
}

/**
 * يمنح الزائر (غير المسجّل دخول) هوية حقيقية مؤقتة عبر "الدخول المجهول"
 * في Firebase، حتى يقدر يقوم بإجراءات محدودة (كالإعجاب) بشكل حقيقي
 * ومتزامن، دون أن يُطلب منه إنشاء حساب أو تسجيل دخول فعلي.
 *
 * ⚠️ هذا لا يُنشئ ملف مستخدم في مجموعة "users" ولا يُحوّل الزائر إلى
 * حساب مسجّل — يبقى بنظر التطبيق زائراً تماماً (انظر معالجة isAnonymous
 * في مستمع onAuthStateChanged بملف App.tsx).
 */
export async function ensureGuestIdentity(): Promise<string | null> {
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (error) {
    console.error('تعذر إنشاء هوية زائر مؤقتة:', error);
    return null;
  }
}

// Update Role in Firestore
export async function updateUserRoleInFirestore(uid: string, newRole: UserRole) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

// Update Wallet in Firestore
export async function updateWalletBalanceInFirestore(uid: string, newBalance: number) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { walletBalance: newBalance });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

// Record Earning in Firestore
export async function recordEarningInFirestore(earningData: {
  userId: string;
  amount: number;
  type: 'ad_cpm' | 'ad_cpc' | 'ad_fixed' | 'article_sale' | 'subscription' | 'bonus';
  source: string;
  articleId?: string;
  campaignId?: string;
}) {
  try {
    const earningsRef = collection(db, 'earnings');
    await addDoc(earningsRef, {
      ...earningData,
      createdAt: new Date().toISOString(),
      status: 'credited'
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'earnings');
  }
}
