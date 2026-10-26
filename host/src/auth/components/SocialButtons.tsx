import React from 'react';

interface SocialButtonsProps {
  onGoogleClick?: () => void;
  isLoading?: boolean;
  buttonText?: string;
}

export const SocialButtons: React.FC<SocialButtonsProps> = ({
  onGoogleClick,
  isLoading = false,
  buttonText = 'Continue with Google',
}) => {
  return (
    <div className="w-full flex flex-col items-center">
      {/* Full-width Official Google Sign-In Button */}
      <button
        type="button"
        onClick={onGoogleClick}
        disabled={isLoading}
        aria-label={buttonText}
        className="w-full min-h-[46px] h-11 md:h-12 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed group"
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-slate-400 border-t-red-500 rounded-full animate-spin" />
            <span className="text-slate-500 dark:text-slate-400">Connecting to Google...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span className="tracking-wide">{buttonText}</span>
          </>
        )}
      </button>

      {/* Trust & encryption subtext */}
      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1 font-mono">
        <span className="material-symbols-outlined text-[13px] text-emerald-500">verified_user</span>
        Google Identity Services 2.0 (OAuth 2.0)
      </span>
    </div>
  );
};
