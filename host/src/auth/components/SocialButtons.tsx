import React, { useEffect, useRef, useState } from 'react';
import { AuthUser } from '../types';

interface SocialButtonsProps {
  tokenServerUrl: string;
  onSuccess: (user: AuthUser) => void;
  onError: (errorMsg: string) => void;
}

const GOOGLE_CLIENT_ID_DEFAULT = '523129607801-ot70ums883plmfi2ie3b7bhhag4lb6ti.apps.googleusercontent.com';

export const SocialButtons: React.FC<SocialButtonsProps> = ({
  tokenServerUrl,
  onSuccess,
  onError,
}) => {
  const [googleClientId, setGoogleClientId] = useState<string>(GOOGLE_CLIENT_ID_DEFAULT);
  const [isGisReady, setIsGisReady] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const btnContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch current Google Client ID from backend
  useEffect(() => {
    fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/config`)
      .then((r) => r.json())
      .then((data) => {
        if (data.googleClientId && data.googleClientId.trim()) {
          setGoogleClientId(data.googleClientId.trim());
        }
      })
      .catch(() => {});
  }, [tokenServerUrl]);

  // 2. Initialize native Google Identity Services (GIS)
  useEffect(() => {
    const clientIdToUse = googleClientId || GOOGLE_CLIENT_ID_DEFAULT;
    let isMounted = true;

    const pollGis = setInterval(() => {
      const google = (window as any).google;
      if (google?.accounts?.id && btnContainerRef.current) {
        clearInterval(pollGis);
        if (!isMounted) return;

        try {
          google.accounts.id.initialize({
            client_id: clientIdToUse,
            callback: async (response: any) => {
              if (!response?.credential) {
                onError('Google account selection cancelled or failed.');
                return;
              }

              setIsVerifying(true);
              try {
                const apiRes = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/google`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });

                const resData = await apiRes.json().catch(() => ({}));

                if (apiRes.ok && resData.user) {
                  onSuccess(resData.user);
                } else {
                  onError(resData.error || 'Google authentication failed to verify.');
                }
              } catch {
                onError(`Cannot connect to server at ${tokenServerUrl} to verify Google account.`);
              } finally {
                setIsVerifying(false);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render Google's official branded sign-in button
          btnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(btnContainerRef.current, {
            type: 'standard',
            theme: document.documentElement.classList.contains('dark') ? 'filled_blue' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: btnContainerRef.current.offsetWidth || 380,
            logo_alignment: 'left',
          });

          // Trigger native Google One-Tap sheet on device
          try {
            google.accounts.id.prompt();
          } catch (_) {}

          setIsGisReady(true);
        } catch (initErr) {
          console.warn('[GIS Init Error]', initErr);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(pollGis);
    };
  }, [googleClientId, tokenServerUrl, onSuccess, onError]);

  // Fallback direct trigger if user clicks the button before GIS iframe mounts
  const handleDirectGoogleClick = () => {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      try {
        google.accounts.id.prompt();
      } catch (err) {
        console.warn('[GIS Prompt Error]', err);
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Google's Official GIS Rendered Button */}
      <div
        ref={btnContainerRef}
        id="google-signin-btn-container"
        className="w-full flex justify-center min-h-[44px]"
      />

      {/* Fallback button while Google iframe finishes initial mount */}
      {!isGisReady && (
        <button
          type="button"
          onClick={handleDirectGoogleClick}
          disabled={isVerifying}
          className="w-full min-h-[46px] h-11 md:h-12 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 group cursor-pointer"
        >
          {isVerifying ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-400 border-t-red-500 rounded-full animate-spin" />
              <span className="text-slate-500 dark:text-slate-400">Verifying Google Account...</span>
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
              <span className="tracking-wide">Sign in with Google</span>
            </>
          )}
        </button>
      )}

      {/* Clean verification badge */}
      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1 font-mono">
        <span className="material-symbols-outlined text-[13px] text-emerald-500">verified_user</span>
        Google Identity Services (OAuth 2.0)
      </span>
    </div>
  );
};
export default SocialButtons;
