import React from 'react';
import { logError, formatErrorReportText } from '../utils/errorLog';

interface Props {
  children: React.ReactNode;
}

// هذا المشروع لا يحمل حزمة أنواع لـ `react` (`@types/react` غير مثبَّتة)،
// فتُعامَل كل مكوّنات React هنا ضمنياً كـ `any` أصلاً — إلا أن extending
// `React.Component` تحديداً يصطدم بفجوة في استدلال TS (لا يستنتج `props`
// الموروثة). عمداً `as any` هنا لتفادي هذه الفجوة بالذات؛ السلوك وقت
// التشغيل سليم تماماً (نفس React.Component الحقيقي).
const ReactComponent = React.Component as any;

/**
 * يلتقط أعطال رسم React (بدل الشاشة البيضاء الفارغة الصامتة التي كانت أكبر
 * بلاغ متكرر من المستخدم) ويعرض بدلاً منها رسالة واضحة + زر نسخ تقرير جاهز
 * + زر إعادة تحميل. الاستدعاء المتضمن (`logError`) يرفع هذا العطل أيضاً
 * تلقائياً لسجل الأخطاء المركزي على الخادم (انظر errorLog.ts).
 */
export class ErrorBoundary extends ReactComponent {
  props!: Props;
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    logError('react-render', error, info?.componentStack ?? undefined);
  }

  private copyReport = () => {
    navigator.clipboard?.writeText(formatErrorReportText()).catch(() => {});
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
          color: '#0f172a'
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>حدث خطأ غير متوقع في الصفحة</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 20, maxWidth: 360 }}>
          يمكنك نسخ تقرير العطل أدناه وإرساله للدعم، أو إعادة تحميل الصفحة للمتابعة.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={this.copyReport}
            style={{
              background: '#0d9488',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            نسخ تقرير العطل
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'white',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    );
  }
}
