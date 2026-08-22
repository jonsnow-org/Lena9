import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Lock,
  BadgePercent,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { User, AdCampaign } from '../../types';
import { evaluateAdEventBatch, calculateEventCost } from '../../utils/fraudFilters';
import { REVENUE_SHARES } from '../../constants/revenueShares';

interface AdminFinanceTabProps {
  users: User[];
  campaigns: AdCampaign[];
  depositRequests?: any[];
  payoutRequests?: any[];
  purchaseRequests?: any[];
  adEvents?: any[];
  earningsRecords?: {
    id: string;
    userId: string;
    amount: number;
    source: string;
    status: string;
    createdAt: string;
    releasableAt: string;
    description?: string;
  }[];
  initialSubTab?: 'payouts' | 'deposits' | 'releasable' | 'locked_sales' | 'ad_accounting';
  onUpdateMoneyRequest?: (
    collectionName: 'depositRequests' | 'payoutRequests',
    requestId: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => void;
  onUpdatePurchaseRequest?: (requestId: string, status: 'approved' | 'rejected') => void;
  onReleaseEarning?: (earning: { id: string; userId: string; amount: number }) => void;
  onProcessAdEvents?: () => void;
  onOpenAdjustBalance?: (user: User) => void;
}

export const AdminFinanceTab: React.FC<AdminFinanceTabProps> = ({
  users,
  campaigns,
  depositRequests = [],
  payoutRequests = [],
  purchaseRequests = [],
  adEvents = [],
  earningsRecords = [],
  initialSubTab = 'payouts',
  onUpdateMoneyRequest,
  onUpdatePurchaseRequest,
  onReleaseEarning,
  onProcessAdEvents,
  onOpenAdjustBalance
}) => {
  const [subTab, setSubTab] = useState<
    'payouts' | 'deposits' | 'releasable' | 'locked_sales' | 'ad_accounting'
  >(initialSubTab);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Releasable calculations
  const now = Date.now();
  const releasableEarnings = useMemo(
    () =>
      earningsRecords.filter(
        (e) =>
          (e.status === 'pending_hold' || e.status === 'pending') &&
          new Date(e.releasableAt).getTime() <= now
      ),
    [earningsRecords, now]
  );

  // Ad accounting calculation
  const unprocessedEvents = useMemo(
    () => adEvents.filter((e: any) => !e.processed),
    [adEvents]
  );

  const advertiserByCampaign: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c) => {
      if (c.id && c.advertiserId) map[c.id] = c.advertiserId;
    });
    return map;
  }, [campaigns]);

  const { validEvents, suspiciousEvents, totalValidCost, writerShares } = useMemo(() => {
    const { valid, suspicious } = evaluateAdEventBatch(
      unprocessedEvents as any,
      advertiserByCampaign
    );

    let totalCost = 0;
    const writerMap: Record<string, number> = {};

    valid.forEach((ev: any) => {
      const camp = campaigns.find((c) => c.id === ev.campaignId);
      if (!camp) return;
      const cost = calculateEventCost(ev, camp);
      if (cost <= 0) return;
      totalCost += cost;
      if (ev.writerId) {
        const share =
          ev.slotId && String(ev.slotId).startsWith('writer_profile')
            ? REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER
            : REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
        writerMap[ev.writerId] = (writerMap[ev.writerId] || 0) + cost * share;
      }
    });

    return {
      validEvents: valid,
      suspiciousEvents: suspicious,
      totalValidCost: totalCost,
      writerShares: writerMap
    };
  }, [unprocessedEvents, advertiserByCampaign, campaigns]);

  const pendingPayoutsCount = payoutRequests.filter((r) => r.status === 'pending').length;
  const pendingDepositsCount = depositRequests.filter((r) => r.status === 'pending').length;
  const pendingPurchasesCount = purchaseRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Sub-tabs Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            المركز المالي وإدارة الحسابات
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            متابعة طلبات السحب، تدقيق الإيداعات، تحرير أرباح الكُتّاب، واحتساب عوائد الإعلانات.
          </p>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex items-center gap-1.5 flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            {
              id: 'payouts',
              label: 'طلبات السحب',
              icon: ArrowUpFromLine,
              badge: pendingPayoutsCount
            },
            {
              id: 'deposits',
              label: 'طلبات الإيداع',
              icon: ArrowDownToLine,
              badge: pendingDepositsCount
            },
            {
              id: 'releasable',
              label: 'تحرير الأرباح (30 يوم)',
              icon: Clock,
              badge: releasableEarnings.length
            },
            {
              id: 'locked_sales',
              label: 'مبيعات المقالات',
              icon: Lock,
              badge: pendingPurchasesCount
            },
            {
              id: 'ad_accounting',
              label: 'احتساب عوائد الإعلانات',
              icon: BadgePercent,
              badge: unprocessedEvents.length
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Safety Guideline Alert */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <h4 className="font-bold text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          إرشادات الأمان المالي والتدقيق
        </h4>
        <ul className="text-[11px] text-amber-200/80 mt-1.5 space-y-1 pe-4">
          <li className="list-disc">لا تعتمد أي إيداع قبل التحقق من وصول الحوالة فعلياً لحسابك البنكي أو محفظة USDT.</li>
          <li className="list-disc">راجع سجل أرباح الكاتب ومعدل النقرات قبل تحويل أي مبلغ سحب خارجي.</li>
          <li className="list-disc">يتم تسجيل كل تعديل رصيد أو اعتماد مالي في سجل التدقيق الدائم.</li>
        </ul>
      </div>

      {/* 1. PAYOUT REQUESTS */}
      {subTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-white text-sm">
              طلبات سحب أرباح الكُتّاب ({payoutRequests.length} طلب إجمالي)
            </h4>
          </div>

          {payoutRequests.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد طلبات سحب حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {payoutRequests.map((req) => {
                const u = users.find((x) => x.id === req.userId);
                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'pending'
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : req.status === 'paid'
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : req.status === 'approved'
                              ? 'bg-sky-500 text-slate-950 font-bold'
                              : 'bg-rose-500 text-white font-bold'
                          }`}
                        >
                          {req.status === 'pending'
                            ? 'بانتظار المراجعة والتحويل'
                            : req.status === 'approved'
                            ? 'معتمد — بانتظار إتمام الدفع'
                            : req.status === 'paid'
                            ? 'تم الدفع بنجاح ✓'
                            : 'مرفوض ✗'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{req.method}</span>
                      </div>
                      <div className="font-bold text-sm text-white truncate">
                        {u ? u.fullName : req.userId}
                        {u && <span className="text-slate-400 text-xs font-mono ms-2">(@{u.username})</span>}
                      </div>
                      {req.destination && (
                        <div className="text-xs text-brand-300 font-mono mt-1 break-all">
                          الوجهة / الحساب: {req.destination}
                        </div>
                      )}
                      {req.createdAt && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          تاريخ الطلب: {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <div className="font-black text-emerald-400 font-mono text-base">
                          ${(req.amount || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">مبلغ السحب</div>
                      </div>

                      {onUpdateMoneyRequest && req.status !== 'paid' && req.status !== 'rejected' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateMoneyRequest('payoutRequests', req.id, 'paid')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                          >
                            تأكيد الدفع
                          </button>
                          <button
                            onClick={() => onUpdateMoneyRequest('payoutRequests', req.id, 'rejected')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. DEPOSIT REQUESTS */}
      {subTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-white text-sm">
              طلبات إيداع وشحن المحفظة ({depositRequests.length} طلب إجمالي)
            </h4>
          </div>

          {depositRequests.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد طلبات إيداع حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {depositRequests.map((req) => {
                const u = users.find((x) => x.id === req.userId);
                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            req.status === 'pending'
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : req.status === 'approved'
                              ? 'bg-emerald-500 text-slate-950 font-bold'
                              : 'bg-rose-500 text-white font-bold'
                          }`}
                        >
                          {req.status === 'pending'
                            ? 'بانتظار التحقق من التحويل'
                            : req.status === 'approved'
                            ? 'معتمد وتم الشحن ✓'
                            : 'مرفوض ✗'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{req.method}</span>
                      </div>
                      <div className="font-bold text-sm text-white truncate">
                        {u ? u.fullName : req.userId}
                        {u && <span className="text-slate-400 text-xs font-mono ms-2">(@{u.username})</span>}
                      </div>
                      {req.reference && (
                        <div className="text-xs text-amber-300 font-mono mt-1">
                          رقم المرجع / الحوالة: {req.reference}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <div className="font-black text-emerald-400 font-mono text-base">
                          ${(req.amount || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">مبلغ الإيداع</div>
                      </div>

                      {req.status === 'pending' && onUpdateMoneyRequest && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateMoneyRequest('depositRequests', req.id, 'approved')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                          >
                            تأكيد الاستلام والشحن
                          </button>
                          <button
                            onClick={() => onUpdateMoneyRequest('depositRequests', req.id, 'rejected')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. RELEASABLE EARNINGS (30-day hold passed) */}
      {subTab === 'releasable' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-black text-white text-sm">
              أرباح انقضت فترة تجميدها (30 يوماً) وجاهزة للتحرير للسحب ({releasableEarnings.length})
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              هذه المبالغ استوفت فترة الضمان، والضغط على "تحرير المبلغ" ينقلها من الأرباح المجمّدة إلى الرصيد المتاح للسحب.
            </p>
          </div>

          {releasableEarnings.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد أرباح تجاوزت فترة التجميد (30 يوماً) في الوقت الحالي.
            </div>
          ) : (
            <div className="space-y-3">
              {releasableEarnings.map((earning) => {
                const u = users.find((x) => x.id === earning.userId);
                return (
                  <div
                    key={earning.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">
                        {u ? u.fullName : earning.userId}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {earning.description || earning.source} • جاهز منذ{' '}
                        {new Date(earning.releasableAt).toLocaleDateString('ar-EG')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="font-black text-emerald-400 font-mono text-base">
                        ${earning.amount.toFixed(2)}
                      </div>
                      {onReleaseEarning && (
                        <button
                          onClick={() => onReleaseEarning(earning)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                        >
                          تحرير للسحب المباشر
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. LOCKED ARTICLE SALES */}
      {subTab === 'locked_sales' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-white text-sm">
              طلبات شراء ومبيعات المقالات الحصرية ({purchaseRequests.length})
            </h4>
          </div>

          {purchaseRequests.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد طلبات شراء مقالات حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseRequests.map((req) => {
                const buyer: any = users.find((x) => x.id === req.buyerId || x.id === req.userId);
                const writer: any = users.find((x) => x.id === req.writerId);
                const writerShare = (req.amount || 0) * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;
                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'pending'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : req.status === 'approved'
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-rose-500 text-white font-bold'
                        }`}
                      >
                        {req.status === 'pending'
                          ? 'بانتظار الاعتماد'
                          : req.status === 'approved'
                          ? 'معتمد ومفتوح للمشتري ✓'
                          : 'مرفوض ✗'}
                      </span>
                      <div className="font-bold text-sm text-white mt-1 truncate">
                        {req.articleTitle || req.articleId}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        المشتري: {buyer ? buyer.fullName : req.buyerId} • الكاتب:{' '}
                        {writer ? writer.fullName : req.writerId}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <div className="font-black text-amber-400 font-mono text-base">
                          ${(req.amount || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          حصة الكاتب 85%: ${writerShare.toFixed(2)}
                        </div>
                      </div>

                      {req.status === 'pending' && onUpdatePurchaseRequest && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdatePurchaseRequest(req.id, 'approved')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                          >
                            اعتماد
                          </button>
                          <button
                            onClick={() => onUpdatePurchaseRequest(req.id, 'rejected')}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. AD REVENUE ACCOUNTING */}
      {subTab === 'ad_accounting' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <h4 className="font-black text-white text-sm">احتساب أرباح إعلانات الكُتّاب وتصفية الأحداث</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              يتم جمع أحداث المشاهدات والنقرات من القراء تلقائياً. يقوم النظام أدناه بفحص كل حدث، وعزل
              النقرات المشبوهة أو السريعة، ثم احتساب الحصص الصالحة وإيداعها في الأرباح المجمّدة للكتاب.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-2xl font-black text-white font-mono">{unprocessedEvents.length}</div>
              <div className="text-xs text-slate-400 mt-1">أحداث غير معالجة</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30">
              <div className="text-2xl font-black text-emerald-400 font-mono">{validEvents.length}</div>
              <div className="text-xs text-slate-400 mt-1">أحداث صالحة للفوترة</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30">
              <div className="text-2xl font-black text-rose-400 font-mono">{suspiciousEvents.length}</div>
              <div className="text-xs text-slate-400 mt-1">أحداث مشبوهة (محجوبة)</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
              <div className="text-2xl font-black text-amber-400 font-mono">
                ${totalValidCost.toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mt-1">إجمالي المستحق</div>
            </div>
          </div>

          {Object.keys(writerShares).length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <h5 className="font-bold text-white text-xs mb-2">حصص الكُتّاب المستحقة من الدفعة الحالية:</h5>
              {Object.entries(writerShares).map(([wId, amt]) => {
                const w = users.find((u) => u.id === wId);
                const numericAmt = typeof amt === 'number' ? amt : Number(amt) || 0;
                return (
                  <div key={wId} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                    <span className="text-slate-300 font-medium">{w ? w.fullName : wId}</span>
                    <span className="font-mono font-bold text-emerald-400">
                      ${numericAmt.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {suspiciousEvents.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <h5 className="font-bold text-rose-300 text-xs mb-2">
                أحداث مشبوهة رصدها درع الأمان — لن تُحتسب:
              </h5>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {suspiciousEvents.slice(0, 20).map((ev: any) => (
                  <div key={ev.id} className="p-2.5 rounded-xl bg-slate-900/80 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-bold">
                        {ev.eventType === 'click' ? 'نقرة إعلان' : 'ظهور إعلان'}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">{ev.slotId}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5 pe-3 text-[11px] text-rose-300">
                      {ev.reasons?.map((r: string, idx: number) => (
                        <li key={idx} className="list-disc">{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unprocessedEvents.length > 0 && onProcessAdEvents && (
            <button
              onClick={onProcessAdEvents}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-lg shadow-emerald-600/20"
            >
              احتساب الأحداث الصالحة وإيداع الأرباح للكتّاب الآن
            </button>
          )}
        </div>
      )}
    </div>
  );
};
