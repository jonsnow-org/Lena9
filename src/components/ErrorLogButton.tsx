import React, { useEffect, useState } from 'react';
import { Bug, X, Copy, Trash2 } from 'lucide-react';
import { getErrorLog, clearErrorLog, subscribeErrorLog, formatErrorReportText, LoggedError } from '../utils/errorLog';

/**
 * زر عائم صغير جداً (يمين-أسفل) يظهر عدّاد الأخطاء المسجَّلة ويفتح نافذة
 * التقرير الجاهز للنسخ. يُرسَم في main.tsx كشقيق مستقل لـ <App/> (خارج
 * ErrorBoundary) عمداً — حتى يبقى يعمل حتى لو تعطّل React نفسه بالكامل، تماماً
 * كما تبقى شاشة CrashReportActivity في نسخة APK تعمل خارج شجرة Compose.
 */
export const ErrorLogButton: React.FC = () => {
  const [entries, setEntries] = useState<LoggedError[]>(() => getErrorLog());
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeErrorLog(() => setEntries(getErrorLog())), []);

  if (entries.length === 0 && !open) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="سجل الأخطاء"
        style={{
          position: 'fixed',
          bottom: 14,
          insetInlineStart: 14,
          zIndex: 9999,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <Bug size={18} />
        {entries.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              insetInlineEnd: -4,
              background: '#0f172a',
              color: 'white',
              fontSize: 9,
              fontWeight: 800,
              borderRadius: 9,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {entries.length > 9 ? '9+' : entries.length}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              background: 'white',
              borderRadius: '20px 20px 0 0',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, sans-serif'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>سجل الأخطاء ({entries.length})</h2>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                disabled={entries.length === 0}
                onClick={() => {
                  navigator.clipboard?.writeText(formatErrorReportText()).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: entries.length === 0 ? '#94a3b8' : '#0d9488',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  padding: '9px 12px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: entries.length === 0 ? 'default' : 'pointer'
                }}
              >
                <Copy size={14} /> {copied ? 'تم النسخ ✓' : 'نسخ التقرير كاملاً'}
              </button>
              <button
                disabled={entries.length === 0}
                onClick={() => clearErrorLog()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'white',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '9px 12px',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: entries.length === 0 ? 'default' : 'pointer'
                }}
              >
                <Trash2 size={14} /> مسح
              </button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.length === 0 ? (
                <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
                  لا توجد أخطاء مسجَّلة — كل شيء يعمل بسلام حالياً.
                </p>
              ) : (
                entries.map((entry) => <ErrorEntryRow key={entry.id} entry={entry} />)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ErrorEntryRow: React.FC<{ entry: LoggedError }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      style={{
        textAlign: 'start',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer'
      }}
    >
      <div style={{ fontSize: 10, color: '#64748b' }}>{entry.time}</div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{entry.source}</div>
      <div style={{ fontSize: 11 }}>{entry.message}</div>
      {expanded && (
        <pre
          style={{
            fontSize: 9,
            color: '#64748b',
            whiteSpace: 'pre-wrap',
            marginTop: 6,
            direction: 'ltr',
            textAlign: 'left'
          }}
        >
          {entry.stack}
        </pre>
      )}
    </button>
  );
};
