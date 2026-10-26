import React, { useEffect, useRef, useState } from 'react';
import { AuthUser } from '../types';

interface SocialButtonsProps {
  tokenServerUrl: string;
  onSuccess: (user: AuthUser) => void;
  onError: (errorMsg: string) => void;
}

export const SocialButtons: React.FC<SocialButtonsProps> = ({
  tokenServerUrl,
  onSuccess,
  onError,
}) => {
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isGisInitialized, setIsGisInitialized] = useState<boolean>(false);
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [customClientIdInput, setCustomClientIdInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch current Google Client ID from backend
  const fetchConfig = async () => {
    try {
      const res = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.googleClientId && data.googleClientId.trim()) {
          setGoogleClientId(data.googleClientId.trim());
          setCustomClientIdInput(data.googleClientId.trim());
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchConfig();
  }, [tokenServerUrl]);

  // 2. Initialize native Google Identity Services (GIS) when Client ID is available
  useEffect(() => {
    if (!googleClientId) {
      setIsGisInitialized(false);
      return;
    }

    let isMounted = true;
    const pollGis = setInterval(() => {
      const google = (window as any).google;
      if (google?.accounts?.id && googleBtnContainerRef.current) {
        clearInterval(pollGis);
        if (!isMounted) return;

        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response: any) => {
              if (!response?.credential) {
                onError('Google did not return credentials. Please try again.');
                return;
              }

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
                  onError(resData.error || 'Google authentication verification failed.');
                }
              } catch {
                onError(`Cannot connect to server at ${tokenServerUrl} to verify Google account.`);
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render Google's official branded button
          googleBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: document.documentElement.classList.contains('dark') ? 'filled_blue' : 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: googleBtnContainerRef.current.offsetWidth || 380,
            logo_alignment: 'left',
          });

          // Also trigger Google's native One-Tap bottom/top sheet on devices
          try {
            google.accounts.id.prompt();
          } catch (_) {}

          setIsGisInitialized(true);
        } catch (initErr) {
          console.warn('[GIS Init Error]', initErr);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearInterval(pollGis);
    };
  }, [googleClientId, tokenServerUrl, onSuccess, onError]);

  // 3. Save Client ID to server configuration
  const handleSaveClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customClientIdInput.trim();
    if (!cleanId) {
      setSaveMessage({ text: 'Please enter a valid Google Client ID', isError: true });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleClientId: cleanId }),
      });

      if (res.ok) {
        setGoogleClientId(cleanId);
        setSaveMessage({ text: 'Connected! Google button is ready.', isError: false });
        setIsSetupOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveMessage({ text: data.error || 'Failed to save Client ID', isError: true });
      }
    } catch {
      setSaveMessage({ text: 'Network error saving Google Client ID', isError: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Container for Google's Official GIS Rendered Button */}
      <div
        ref={googleBtnContainerRef}
        id="google-signin-btn-container"
        className={`w-full flex justify-center min-h-[44px] transition-all ${
          !googleClientId ? 'hidden' : ''
        }`}
      />

      {/* When Client ID is NOT set, show clear setup trigger without fake names */}
      {!googleClientId && (
        <button
          type="button"
          onClick={() => setIsSetupOpen(!isSetupOpen)}
          className="w-full min-h-[46px] h-11 md:h-12 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 group cursor-pointer"
        >
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
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold ml-1">
            Setup
          </span>
        </button>
      )}

      {/* Google Cloud Client ID Input & Guidance Box */}
      {(!googleClientId || isSetupOpen) && (
        <div className="w-full mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left text-xs transition-all animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-500">key</span>
              Connect Real Google Account Sign-In
            </span>
            {googleClientId && (
              <button
                type="button"
                onClick={() => setIsSetupOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Close
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            To display the real Google account picker from your phone or browser, enter your free{' '}
            <strong className="text-slate-700 dark:text-slate-200">Google Cloud OAuth Web Client ID</strong>:
          </p>

          <form onSubmit={handleSaveClientId} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="xxxx.apps.googleusercontent.com"
                value={customClientIdInput}
                onChange={(e) => setCustomClientIdInput(e.target.value)}
                className="flex-1 text-xs font-mono p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <button
                type="submit"
                disabled={isSaving || !customClientIdInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all disabled:opacity-50 shrink-0"
              >
                {isSaving ? 'Saving...' : 'Connect'}
              </button>
            </div>

            {saveMessage && (
              <span
                className={`text-[11px] font-medium mt-1 ${
                  saveMessage.isError ? 'text-red-500' : 'text-emerald-500'
                }`}
              >
                {saveMessage.text}
              </span>
            )}
          </form>

          {/* Collapsible 3-Step Setup Instructions */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              How to get your Client ID in 2 minutes:
            </span>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google Cloud Console &rarr; Credentials</a></li>
              <li>Click <strong>Create Credentials &rarr; OAuth Client ID &rarr; Web application</strong></li>
              <li>Add <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">http://localhost:5173</code> to <strong>Authorized JavaScript origins</strong></li>
              <li>Paste the generated Client ID above</li>
            </ol>
          </div>
        </div>
      )}

      {/* Subtext when GIS is ready */}
      {googleClientId && isGisInitialized && (
        <div className="flex items-center justify-between w-full mt-2 px-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Native Google GIS 2.0 Active
          </span>
          <button
            type="button"
            onClick={() => setIsSetupOpen(!isSetupOpen)}
            className="hover:text-blue-500 underline"
          >
            Change Client ID
          </button>
        </div>
      )}
    </div>
  );
};
