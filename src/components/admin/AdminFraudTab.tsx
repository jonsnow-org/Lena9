import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Ban,
  Activity,
  DollarSign
} from 'lucide-react';
import { FraudFlag, User } from '../../types';

interface AdminFraudTabProps {
  fraudFlags: FraudFlag[];
  users: User[];
  onResolveFraudFlag?: (flagId: string, action: 'resolved' | 'dismissed') => void;
  onBanUser?: (userId: string) => void;
  totalBlockedFraudRevenue: number;
}

export const AdminFraudTab: React.FC<AdminFraudTabProps> = ({
  fraudFlags,
  users,
  onResolveFraudFlag,
  onBanUser,
  totalBlockedFraudRevenue
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'auto_blocked' | 'reviewed' | 'dismissed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFlags = fraudFlags.filter((flag) => {
    if (severityFilter !== 'all' && flag.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && flag.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIp = flag.userIp?.toLowerCase().includes(q);
      const matchDetails = flag.details?.toLowerCase().includes(q);
      const matchUser = flag.userId?.toLowerCase().includes(q);
      if (!matchIp && !matchDetails && !matchUser) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            مركز مكافحة الاحتيال والأمان (Anti-Fraud SOC)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            الرصد الفوري للنقر الذاتي، البوتات، وحماية ميزانيات المعلنين وأرباح المنصة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-slate-300">الأموال المحمية:</span>
            <span className="font-mono font-bold text-amber-400">
              ${totalBlockedFraudRevenue.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-2xl font-black text-white font-mono">{fraudFlags.length}</div>
          <div className="text-xs text-slate-400 mt-1">إجمالي المحاولات المرصودة</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-red-500/30">
          <div className="text-2xl font-black text-rose-400 font-mono">
            {fraudFlags.filter((f) => f.severity === 'high' || f.severity === 'critical').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">عالية الخطورة (حرجة)</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
          <div className="text-2xl font-black text-amber-400 font-mono">
            {fraudFlags.filter((f) => f.status === 'flagged' || f.status === 'auto_blocked').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">بانتظار المراجعة</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30">
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {fraudFlags.filter((f) => f.status === 'reviewed').length}
          </div>
          <div className="text-xs text-slate-400 mt-1">تمت المراجعة والتحييد</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="البحث في عنوان IP، المعرف، أو تفاصيل الإنذار..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'الخطورة: الكل' },
              { id: 'critical', label: 'حرجة' },
              { id: 'high', label: 'عالية' },
              { id: 'medium', label: 'متوسطة' },
              { id: 'low', label: 'منخفضة' }
            ].map((sf) => (
              <button
                key={sf.id}
                onClick={() => setSeverityFilter(sf.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  severityFilter === sf.id
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fraud Incidents List */}
      {filteredFlags.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
          لا توجد سجلات احتيال تطابق هذا الفلتر حالياً.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFlags.map((flag) => {
            const suspectUser = flag.userId ? users.find((u) => u.id === flag.userId) : null;
            const isResolved = flag.status === 'reviewed';

            return (
              <div
                key={flag.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                        flag.severity === 'critical' || flag.severity === 'high'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {flag.severity}
                    </span>
                    <span className="font-bold text-sm text-white">{flag.details}</span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono flex items-center gap-3 flex-wrap">
                    <span>IP: {flag.userIp}</span>
                    <span>•</span>
                    <span>الموقع: {flag.articleId || flag.campaignId || 'عام'}</span>
                    <span>•</span>
                    <span>{flag.detectedAt}</span>
                  </div>

                  {suspectUser && (
                    <div className="text-xs text-amber-300 flex items-center gap-1.5 pt-1">
                      <span>المستخدم المشتبه به:</span>
                      <span className="font-bold">{suspectUser.fullName}</span>
                      <span className="font-mono text-slate-400">(@{suspectUser.username})</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {onResolveFraudFlag && !isResolved && (
                    <>
                      <button
                        onClick={() => onResolveFraudFlag(flag.id, 'resolved')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تأكيد الحجب والمراجعة</span>
                      </button>
                      <button
                        onClick={() => onResolveFraudFlag(flag.id, 'dismissed')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all"
                      >
                        تجاهل الإنذار
                      </button>
                    </>
                  )}

                  {suspectUser && onBanUser && !suspectUser.isBanned && (
                    <button
                      onClick={() => onBanUser(suspectUser.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1"
                      title="حظر المستخدم المعتدي فوراً"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>حظر الحساب</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
