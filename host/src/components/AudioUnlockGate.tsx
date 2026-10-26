import React, { useState } from 'react';

interface AudioUnlockGateProps {
  isUnlocked: boolean;
  onUnlock: () => Promise<void>;
}

export const AudioUnlockGate: React.FC<AudioUnlockGateProps> = ({ isUnlocked, onUnlock }) => {
  const [isActivating, setIsActivating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // When unlocked or dismissed, do not render
  if (isUnlocked || isDismissed) {
    return null;
  }

  const handleStart = async () => {
    try {
      setIsActivating(true);
      await onUnlock();
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-[#141923] border border-amber-500/50 rounded-2xl p-4 shadow-[0_12px_36px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fadeIn select-none text-left"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222834]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-[20px]">volume_up</span>
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            PA Audio Standby
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="Dismiss notification"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
        Browser autoplay policy requires an activation tap to unmute 48kHz audio to room speakers.
      </p>

      <button
        type="button"
        onClick={handleStart}
        disabled={isActivating}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider font-mono transition-all shadow-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500/50"
      >
        <span className="material-symbols-outlined text-[16px]">play_arrow</span>
        <span>{isActivating ? 'Activating Audio...' : 'Activate PA Speakers'}</span>
      </button>
    </div>
  );
};
