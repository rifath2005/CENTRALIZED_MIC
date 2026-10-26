import React, { useState } from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy';
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-left relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h3 id="terms-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
          Legal Agreements
        </h3>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mt-3 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'terms'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'privacy'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Privacy Policy
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {activeTab === 'terms' ? (
            <>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">1. Acceptance of Terms</h4>
              <p>
                By accessing and using Centralized Mic PA broadcast system, you agree to comply with and be bound by these terms. This software is designed for enterprise meeting audio synchronization and PA management.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">2. Operator Responsibilities</h4>
              <p>
                Operators must ensure that microphone transmitters connected to the system comply with local acoustic safety regulations. The automated peak limiter and transient breaker are provided as safety assistants; operators retain ultimate administrative control.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">3. Acceptable Audio Use</h4>
              <p>
                Transmission of unauthorized recordings or malicious acoustic interference is strictly prohibited and subject to immediate administrative floor revocation.
              </p>
            </>
          ) : (
            <>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">1. Data Minimization</h4>
              <p>
                Centralized Mic processes live WebRTC audio streams in real time. We do not store, record, or retain participant voice feeds without explicit host administrative configuration.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">2. Account Information</h4>
              <p>
                Authentication credentials for operators are secured using industry-standard salting and cryptographic hashing. Session tokens are signed using cryptographic keys.
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">3. Local Network Privacy</h4>
              <p>
                In peer-to-peer or local LAN modes, room tokens and audio packets travel strictly across your local intranet and do not traverse third-party servers.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
