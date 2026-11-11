import React, { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../auth/types';

interface OperatorPendingApprovalViewProps {
  currentUser: AuthUser;
  tokenServerUrl: string;
  onStatusApproved: (user: AuthUser) => void;
  onSignOut: () => void;
}

export const OperatorPendingApprovalView: React.FC<OperatorPendingApprovalViewProps> = ({
  currentUser,
  tokenServerUrl,
  onStatusApproved,
  onSignOut,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const isRejected = currentUser.status === 'rejected';

  const checkStatus = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setIsChecking(true);
        setCheckFeedback(null);
      }

      try {
        const res = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setLastCheckedAt(new Date());

          if (data.user?.status === 'approved') {
            onStatusApproved({
              ...currentUser,
              ...data.user,
              token: currentUser.token,
            });
            return;
          }

          if (isManual) {
            if (data.user?.status === 'rejected') {
              setCheckFeedback('Your application was reviewed and declined by the administrator.');
            } else {
              setCheckFeedback('Your account is still pending administrator review. Please check back shortly.');
            }
          }
        }
      } catch {
        if (isManual) {
          setCheckFeedback('Unable to reach the server. Please check your network connection.');
        }
      } finally {
        if (isManual) {
          setIsChecking(false);
          setTimeout(() => setCheckFeedback(null), 5000);
        }
      }
    },
    [currentUser, tokenServerUrl, onStatusApproved]
  );

  // Auto-poll approval status every 10 seconds so the screen automatically unlocks when approved
  useEffect(() => {
    if (isRejected) return;

    const interval = setInterval(() => {
      checkStatus(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [checkStatus, isRejected]);

  return (
    <div className="min-h-screen w-full bg-[#080a0e] text-[#f1f5f9] flex flex-col justify-between font-sans selection:bg-red-600 selection:text-white select-none">
      {/* ─── TOP NAVIGATION HEADER ─── */}
      <header className="h-16 px-4 md:px-6 bg-[#0c0f16]/90 backdrop-blur-md border-b border-[#1e2430] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Centralized PA
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                v2.0
              </span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Venue Broadcast Network</span>
          </div>
        </div>

        {/* User Pill & Sign Out Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121620] border border-[#222834]">
            <div className="w-6 h-6 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-xs uppercase">
              {currentUser.fullName ? currentUser.fullName[0] : 'U'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-none">
                {currentUser.fullName}
              </span>
              <span className="text-[10px] font-mono text-slate-400 leading-tight">
                {currentUser.email}
              </span>
            </div>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                isRejected
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isRejected ? 'DECLINED' : 'PENDING'}
            </span>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ─── MAIN PENDING STATUS CARD ─── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-xl rounded-3xl bg-[#0f131a] border border-[#222834] shadow-2xl p-6 sm:p-8 text-center flex flex-col items-center animate-fadeIn">
          {/* Animated Status Icon */}
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 relative ${
              isRejected
                ? 'bg-rose-500/10 border-2 border-rose-500/30 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]'
                : 'bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
            }`}
          >
            {!isRejected && (
              <span className="absolute inset-0 rounded-3xl border border-amber-400/40 animate-ping opacity-25" />
            )}
            <span className="material-symbols-outlined text-[44px]">
              {isRejected ? 'person_cancel' : 'hourglass_top'}
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isRejected ? 'Account Access Declined' : 'Account Under Review'}
          </h2>
          <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
            {isRejected ? (
              <>
                Your application for operator access has been declined by the system administrator.
                If you believe this was in error, please contact venue operations.
              </>
            ) : (
              <>
                Welcome, <strong className="text-slate-100">{currentUser.fullName}</strong>. Your
                operator registration has been recorded successfully and is awaiting review by a system
                administrator before granting access to live broadcasting and microphone floor control.
              </>
            )}
          </p>

          {/* Interactive Check Feedback Banner */}
          {checkFeedback && (
            <div
              role="alert"
              className="w-full mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-center gap-2 animate-fadeIn"
            >
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>{checkFeedback}</span>
            </div>
          )}

          {/* Operator Registration Card */}
          <div className="w-full mt-6 p-4 rounded-2xl bg-[#080a0e] border border-[#1e2430] text-left flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#181d28]">
              <span className="text-[11px] font-mono text-slate-500 uppercase font-semibold">
                REGISTRATION DETAILS
              </span>
              <span
                className={`flex items-center gap-1 text-[11px] font-mono font-bold ${
                  isRejected ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRejected ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                {isRejected ? 'DECLINED' : 'AWAITING APPROVAL'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-[11px] text-slate-500 block">Operator Name</span>
                <span className="font-semibold text-slate-200">{currentUser.fullName}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Email Address</span>
                <span className="font-semibold text-slate-200 truncate block">
                  {currentUser.email}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Requested Role</span>
                <span className="font-semibold text-slate-200">System Operator (PA / Floor)</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Last Verification</span>
                <span className="font-mono text-slate-300">
                  {lastCheckedAt.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
            {!isRejected && (
              <button
                type="button"
                onClick={() => checkStatus(true)}
                disabled={isChecking}
                className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isChecking ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Checking Status...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    <span>Check Approval Status</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className={`min-h-[46px] py-2.5 px-4 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                isRejected ? 'w-full bg-slate-800' : 'sm:w-36'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Sign Out</span>
            </button>
          </div>

          {/* Auto-check Notice Footer */}
          {!isRejected && (
            <p className="text-[11px] text-slate-500 mt-4 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
              <span>Live monitor active: this screen will auto-refresh the moment your account is approved.</span>
            </p>
          )}
        </div>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="py-4 px-6 border-t border-[#181d28] text-center text-xs text-slate-500">
        AirMic Centralized PA Security • Unauthorized broadcasting is prohibited.
      </footer>
    </div>
  );
};
