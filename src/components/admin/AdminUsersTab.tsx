import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Ban,
  DollarSign,
  UserCheck,
  Megaphone,
  User as UserIcon,
  Send,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { User } from '../../types';

interface AdminUsersTabProps {
  users: User[];
  currentUser: User;
  onUpdateUserRole?: (userId: string, newRole: User['role']) => void;
  onToggleUserVerified?: (userId: string) => void;
  onApproveKyc?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
  onSelectUser?: (user: User) => void;
  onBroadcastMessage?: (message: string) => void;
  onOpenAdjustBalance: (user: User) => void;
  onOpenKycReview: (user: User) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  currentUser,
  onUpdateUserRole,
  onToggleUserVerified,
  onBanUser,
  onSelectUser,
  onBroadcastMessage,
  onOpenAdjustBalance,
  onOpenKycReview
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | User['role']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'kyc_pending' | 'banned'>('all');

  // Broadcast Message State
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'verified' && !u.isVerified && !u.isKycVerified) return false;
    if (statusFilter === 'kyc_pending' && u.kycDetails?.status !== 'pending') return false;
    if (statusFilter === 'banned' && !u.isBanned) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.fullName?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchUser = u.username?.toLowerCase().includes(q);
      const matchId = u.id?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchUser && !matchId) return false;
    }

    return true;
  });

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim() || !onBroadcastMessage) return;

    onBroadcastMessage(broadcastText.trim());
    setBroadcastSent(true);
    setTimeout(() => {
      setBroadcastSent(false);
      setBroadcastText('');
      setIsBroadcastOpen(false);
    }, 1500);
  };

  const pendingKycCount = users.filter((u) => u.kycDetails?.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            إدارة المستخدمين والحسابات
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            التحكم في الرتب، توثيق الهوية KYC، تعديل الأرصدة، وإرسال التعميمات الجماعية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBroadcastMessage && (
            <button
              onClick={() => setIsBroadcastOpen(!isBroadcastOpen)}
              className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-brand-600/20"
            >
              <Megaphone className="w-4 h-4" />
              <span>إرسال تعميم لجميع المستخدمين</span>
            </button>
          )}
        </div>
      </div>

      {/* Broadcast Message Card if open */}
      {isBroadcastOpen && (
        <form onSubmit={handleSendBroadcast} className="p-5 rounded-2xl bg-brand-950/40 border border-brand-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand-400" />
              رسالة تعميم جماعية إلى {users.length} مستخدم
            </h4>
            <button
              type="button"
              onClick={() => setIsBroadcastOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              إغلاق
            </button>
          </div>

          {broadcastSent ? (
            <div className="p-4 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs text-center">
              تم إرسال التعميم الجماعي بنجاح إلى جميع صناديق الوارد!
            </div>
          ) : (
            <>
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                rows={2}
                placeholder="اكتب نص الرسالة الرسمية من إدارة المنصة..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!broadcastText.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال التعميم الآن</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="البحث بالاسم، المعرف (@)، البريد الإلكتروني أو ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'admin', label: 'الإدارة' },
              { id: 'writer', label: 'الكتاب' },
              { id: 'advertiser', label: 'المعلنون' },
              { id: 'reader', label: 'القراء' }
            ].map((rf) => (
              <button
                key={rf.id}
                onClick={() => setRoleFilter(rf.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  roleFilter === rf.id
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'الحالة: الكل' },
              { id: 'verified', label: 'موثق' },
              { id: 'kyc_pending', label: `بانتظار KYC (${pendingKycCount})` },
              { id: 'banned', label: 'محظور' }
            ].map((sf) => (
              <button
                key={sf.id}
                onClick={() => setStatusFilter(sf.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === sf.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List Cards */}
      {filteredUsers.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
          لا يوجد مستخدمون يطابقون شروط البحث الحالية.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const isSelf = u.id === currentUser.id;
            const isKycPending = u.kycDetails?.status === 'pending';

            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl bg-slate-900 border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  u.isBanned
                    ? 'border-rose-500/40 bg-rose-950/10'
                    : isKycPending
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={u.avatarUrl}
                    alt={u.fullName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-800 shrink-0"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">{u.fullName}</span>
                      {u.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      {u.isKycVerified && (
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {u.isBanned && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                          محظور
                        </span>
                      )}
                      {isKycPending && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse">
                          طلب توثيق KYC جديد ⏳
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span>@{u.username}</span>
                      <span>•</span>
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                      <span>المحفظة: ${(u.walletBalance || 0).toFixed(2)}</span>
                      <span>•</span>
                      <span>متاح للسحب: ${(u.availableBalance || 0).toFixed(2)}</span>
                      <span>•</span>
                      <span>أرباح مجمّدة: ${(u.pendingEarnings || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions & Role Controls */}
                <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                  {/* Role Selector */}
                  {onUpdateUserRole && !isSelf && (
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateUserRole(u.id, e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-brand-500 font-bold"
                    >
                      <option value="reader">قارئ</option>
                      <option value="writer">كاتب</option>
                      <option value="advertiser">معلن</option>
                      <option value="admin">مدير / Admin</option>
                    </select>
                  )}

                  {/* KYC Review Button */}
                  {isKycPending && (
                    <button
                      onClick={() => onOpenKycReview(u)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>تدقيق الهوية</span>
                    </button>
                  )}

                  {/* Adjust Balance Button */}
                  <button
                    onClick={() => onOpenAdjustBalance(u)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>تعديل الرصيد</span>
                  </button>

                  {/* Toggle Verified Badge */}
                  {onToggleUserVerified && !isSelf && (
                    <button
                      onClick={() => onToggleUserVerified(u.id)}
                      className={`p-1.5 rounded-xl border text-xs font-bold transition-colors ${
                        u.isVerified
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                      title={u.isVerified ? 'إلغاء شارة التوثيق الزرقاء' : 'منح شارة التوثيق الزرقاء'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Ban/Unban */}
                  {onBanUser && !isSelf && (
                    <button
                      onClick={() => onBanUser(u.id)}
                      className={`p-1.5 rounded-xl border text-xs font-bold transition-colors ${
                        u.isBanned
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-rose-400 hover:border-rose-500/40'
                      }`}
                      title={u.isBanned ? 'إلغاء الحظر' : 'حظر المستخدم'}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}

                  {/* View Profile */}
                  {onSelectUser && (
                    <button
                      onClick={() => onSelectUser(u)}
                      className="p-1.5 rounded-xl bg-slate-950 text-slate-400 border border-slate-800 hover:text-white transition-colors"
                      title="معاينة الملف الشخصي"
                    >
                      <Eye className="w-4 h-4" />
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
