import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SpeakerInfo } from '../types';

interface FullScreenQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  tokenServerUrl: string;
  memberCount: number;
  currentSpeaker?: SpeakerInfo | null;
}

export const FullScreenQrModal: React.FC<FullScreenQrModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  tokenServerUrl,
  memberCount,
  currentSpeaker,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBrightMode, setIsBrightMode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrSize, setQrSize] = useState(480);

  const webTransmitterUrl = `${tokenServerUrl.replace(/\/$/, '')}/mic?room=${encodeURIComponent(roomCode)}`;

  // Dynamically calculate massive QR code dimensions based on laptop screen height & width
  useEffect(() => {
    const updateSize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      if (vw < 768) {
        // Mobile / narrow view
        setQrSize(Math.min(vw - 48, 340));
      } else {
        // Laptop / desktop screen: scale with viewport height so it covers the screen vertically
        const target = Math.min(Math.floor(vh * 0.62), Math.floor(vw * 0.42), 580);
        setQrSize(Math.max(340, target));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen]);

  // Handle ESC key to close & sync fullscreen state
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen, onClose]);

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[FullScreenQr] Fullscreen toggle error:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('[FullScreenQr] Clipboard error:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(webTransmitterUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('[FullScreenQr] Clipboard error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] w-screen h-screen flex flex-col transition-colors duration-300 select-none overflow-hidden ${
        isBrightMode ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#06080c] text-[#f1f5f9]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Full Screen Meeting Pairing QR and Room Code"
    >
      {/* 1. TOP UTILITY BAR */}
      <header
        className={`h-16 px-4 md:px-8 flex items-center justify-between border-b transition-colors ${
          isBrightMode
            ? 'bg-white/90 border-slate-200 shadow-sm'
            : 'bg-[#0a0d14]/90 border-[#1f2735] shadow-lg'
        }`}
      >
        {/* Left: Broadcast Status & Connected Counter */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              isBrightMode
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-[#141923] border-[#222834] text-[#f1f5f9]'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ef4444]" />
            </span>
            <span className="text-xs font-mono font-bold tracking-wider uppercase">
              AUDITORIUM AIRMIC BROADCAST
            </span>
          </div>

          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              isBrightMode
                ? 'bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-[#0f131a] border-[#222834] text-[#94a3b8]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#10b981]">devices</span>
            <span className="text-xs font-mono font-semibold">
              <strong className={isBrightMode ? 'text-slate-900' : 'text-white'}>
                {memberCount}
              </strong>{' '}
              {memberCount === 1 ? 'Attendee Phone' : 'Attendee Phones'} Paired
            </span>
          </div>
        </div>

        {/* Right: Mode Toggles & Exit Full Screen */}
        <div className="flex items-center gap-2.5">
          {/* Contrast Toggle */}
          <button
            onClick={() => setIsBrightMode(!isBrightMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              isBrightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-[#141923] hover:bg-[#1a2130] border-[#222834] text-[#cbd5e1]'
            }`}
            title="Toggle contrast mode for bright room projectors"
          >
            <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">
              {isBrightMode ? 'dark_mode' : 'light_mode'}
            </span>
            <span className="hidden md:inline">
              {isBrightMode ? 'Dark Room Mode' : 'Bright Room Mode'}
            </span>
          </button>

          {/* Browser Fullscreen (F11) Toggle */}
          <button
            onClick={toggleBrowserFullscreen}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              isFullscreen
                ? 'bg-[#ef4444] text-white border-[#ef4444]'
                : isBrightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-[#141923] hover:bg-[#1a2130] border-[#222834] text-[#cbd5e1]'
            }`}
            title="Toggle true browser fullscreen to cover 100% of laptop screen"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span className="hidden md:inline">
              {isFullscreen ? 'Exit Laptop Fullscreen' : 'Laptop Fullscreen'}
            </span>
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all shadow-md"
            title="Close full screen display (Esc)"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>Close (Esc)</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN FULL-SCREEN COVER CONTENT: LEFT = FULL-SIZE QR, RIGHT = BIG ROOM CODE */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-12 p-4 sm:p-6 md:p-8 lg:p-12 items-center justify-center max-w-[1700px] mx-auto overflow-y-auto">
        {/* LEFT COLUMN: FULL-SIZE MASSIVE QR CODE (md:col-span-6 lg:col-span-7) */}
        <div className="md:col-span-6 lg:col-span-7 flex flex-col items-center justify-center h-full">
          <div
            className={`relative flex flex-col items-center justify-center p-6 sm:p-8 lg:p-10 rounded-3xl transition-all shadow-2xl border-4 ${
              isBrightMode
                ? 'bg-white border-slate-300 shadow-[0_20px_60px_rgba(0,0,0,0.12)]'
                : 'bg-white border-[#273244] shadow-[0_0_80px_rgba(239,68,68,0.22)]'
            }`}
          >
            {/* The Giant QR Code (Sharp black on white for maximum optical contrast & long distance scanning) */}
            <div className="flex items-center justify-center bg-white rounded-2xl overflow-hidden p-2">
              <QRCodeSVG
                value={webTransmitterUrl}
                size={qrSize}
                bgColor="#ffffff"
                fgColor="#000000"
                level="Q"
                includeMargin={true}
              />
            </div>

            {/* Scan Guidance Pill underneath QR */}
            <div className="mt-4 sm:mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-[#080a0e] text-[#f1f5f9] border border-[#222834] shadow-md">
              <span className="material-symbols-outlined text-[#38bdf8] text-[20px] animate-pulse">
                qr_code_scanner
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold tracking-wider uppercase">
                POINT PHONE CAMERA TO SCAN &amp; JOIN
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BIG ROOM CODE & AUDIENCE INSTRUCTIONS (md:col-span-6 lg:col-span-5) */}
        <div className="md:col-span-6 lg:col-span-5 flex flex-col justify-center gap-5 sm:gap-6 lg:gap-8 h-full">
          {/* Header Subtitle */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span
                className={`text-xs sm:text-sm font-mono font-bold tracking-widest uppercase ${
                  isBrightMode ? 'text-rose-700' : 'text-[#ef4444]'
                }`}
              >
                MEETING MICROPHONE ACCESS
              </span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight ${
                isBrightMode ? 'text-slate-900' : 'text-white'
              }`}
            >
              Audience Stage Audio
            </h1>
            <p
              className={`text-xs sm:text-sm mt-1 ${
                isBrightMode ? 'text-slate-600' : 'text-[#94a3b8]'
              }`}
            >
              Scan the giant QR code on the left, or enter this room code on your smartphone:
            </p>
          </div>

          {/* GIANT ROOM CODE DISPLAY BOX */}
          <div
            className={`w-full rounded-3xl p-5 sm:p-7 lg:p-8 flex flex-col gap-3 transition-all border-2 shadow-2xl ${
              isBrightMode
                ? 'bg-rose-50/70 border-rose-300 shadow-[0_12px_40px_rgba(225,29,72,0.1)]'
                : 'bg-[#0f141e] border-[#ef4444]/60 shadow-[0_0_50px_rgba(239,68,68,0.18)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] sm:text-xs font-mono font-bold tracking-widest uppercase ${
                  isBrightMode ? 'text-rose-700' : 'text-[#94a3b8]'
                }`}
              >
                EVENT ROOM CODE
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                  isBrightMode
                    ? 'bg-white border-rose-200 text-rose-600'
                    : 'bg-[#181f2c] border-[#273244] text-[#38bdf8]'
                }`}
              >
                LIVE STAGE
              </span>
            </div>

            {/* THE ROOM CODE AS BIG FONT (Easily read from far away across the meeting hall) */}
            <div className="py-2 flex items-center justify-center">
              <span
                className={`font-mono font-black tracking-widest leading-none select-all text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl ${
                  isBrightMode
                    ? 'text-rose-700 drop-shadow-sm'
                    : 'text-[#ef4444] drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]'
                }`}
              >
                {roomCode}
              </span>
            </div>

            {/* Quick Actions Row: Copy Code & Copy Link */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-dashed border-[#222834]">
              <button
                onClick={handleCopyCode}
                className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  isBrightMode
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-[#181f2c] hover:bg-[#222b3e] text-[#f1f5f9] border-[#273244]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">
                  {copiedCode ? 'check' : 'content_copy'}
                </span>
                <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                  isBrightMode
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-[#181f2c] hover:bg-[#222b3e] text-[#f1f5f9] border-[#273244]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] text-[#38bdf8]">
                  {copiedLink ? 'check' : 'link'}
                </span>
                <span>{copiedLink ? 'Copied Link!' : 'Copy Web Link'}</span>
              </button>
            </div>
          </div>

          {/* DIRECT BROWSER ADDRESS BAR */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-mono ${
              isBrightMode
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-[#0a0d14] border-[#1e2534] text-[#94a3b8]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-[#38bdf8]">language</span>
              <span className="truncate select-all text-[#38bdf8] font-bold">
                {webTransmitterUrl}
              </span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                isBrightMode ? 'bg-slate-100 text-slate-600' : 'bg-[#141923] text-[#64748b]'
              }`}
            >
              OPUS 48kHz
            </span>
          </div>

          {/* 3-STEP AUDIENCE GUIDE */}
          <div className="grid grid-cols-3 gap-2.5">
            <div
              className={`p-3 rounded-2xl border flex flex-col gap-1 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#ef4444]">
                <span>01</span>
                <span>SCAN QR</span>
              </div>
              <p className="text-[11px] leading-tight text-[#94a3b8]">
                Open iPhone/Android camera to launch browser.
              </p>
            </div>

            <div
              className={`p-3 rounded-2xl border flex flex-col gap-1 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#f59e0b]">
                <span>02</span>
                <span>REQUEST</span>
              </div>
              <p className="text-[11px] leading-tight text-[#94a3b8]">
                Tap &quot;Join Stage&quot; to queue for mic floor.
              </p>
            </div>

            <div
              className={`p-3 rounded-2xl border flex flex-col gap-1 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#10b981]">
                <span>03</span>
                <span>SPEAK</span>
              </div>
              <p className="text-[11px] leading-tight text-[#94a3b8]">
                Hold or tap button to speak through PA.
              </p>
            </div>
          </div>

          {/* LIVE PRESENTER BANNER (IF ACTIVE) */}
          {currentSpeaker && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isBrightMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-[#0d1f18] border-[#10b981]/50 text-[#a7f3d0]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider">
                  CURRENT SPEAKER ON AIR:
                </span>
                <span className="text-sm font-bold text-white uppercase">{currentSpeaker.name}</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#10b981]">LIVE AUDIO</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
