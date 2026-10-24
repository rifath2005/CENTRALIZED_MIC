import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SpeakerInfo, BoardroomMember, QueueEntry } from '../types';

interface FullScreenQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  tokenServerUrl: string;
  memberCount: number;
  currentSpeaker?: SpeakerInfo | null;
  members?: BoardroomMember[];
  queue?: QueueEntry[];
}

// Consistent, vibrant avatar color palette
function getAvatarColor(name?: string): string {
  if (!name || !name.trim()) return '#e11d48';
  const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#e11d48'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return '??';
  const parts = name.trim().split(/[\s-_]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

export const FullScreenQrModal: React.FC<FullScreenQrModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  tokenServerUrl,
  memberCount,
  currentSpeaker,
  members = [],
  queue = [],
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBrightMode, setIsBrightMode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrSize, setQrSize] = useState(480);

  const webTransmitterUrl = `${tokenServerUrl.replace(/\/$/, '')}/mic?room=${encodeURIComponent(roomCode)}`;

  // Display only real, connected attendees in the room (no mock data)
  const displayMembers: BoardroomMember[] = members;
  const totalAttendeeCount = memberCount ?? displayMembers.length;

  // Dynamically calculate massive QR code dimensions based on laptop screen height & width
  useEffect(() => {
    const updateSize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      if (vw < 768) {
        setQrSize(Math.min(vw - 48, 340));
      } else {
        // Laptop screen: occupy optimal height for long-distance optical scanning
        const target = Math.min(Math.floor(vh * 0.60), Math.floor(vw * 0.40), 560);
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
      aria-label="Full Screen Meeting Pairing QR, Room Code, and Attendees"
    >
      {/* 1. TOP UTILITY BAR */}
      <header
        className={`h-16 px-4 md:px-8 flex items-center justify-between border-b transition-colors ${
          isBrightMode
            ? 'bg-white/90 border-slate-200 shadow-sm'
            : 'bg-[#0a0d14]/90 border-[#1f2735] shadow-lg'
        }`}
      >
        {/* Left: Broadcast Status & Total Attendees Counter */}
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
            <span className="material-symbols-outlined text-[16px] text-[#10b981]">groups</span>
            <span className="text-xs font-mono font-semibold">
              <strong className={isBrightMode ? 'text-slate-900' : 'text-white'}>
                {displayMembers.length}
              </strong>{' '}
              {displayMembers.length === 1 ? 'Attendee Present' : 'Attendees Present'}
            </span>
          </div>
        </div>

        {/* Right: Mode Toggles & Exit Full Screen */}
        <div className="flex items-center gap-2.5">
          {/* Contrast Mode Toggle */}
          <button
            onClick={() => setIsBrightMode(!isBrightMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              isBrightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-[#141923] hover:bg-[#1a2130] border-[#222834] text-[#cbd5e1]'
            }`}
            title="Toggle contrast mode for bright room projectors"
            type="button"
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
            type="button"
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
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>Close (Esc)</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN FULL-SCREEN COVER CONTENT: LEFT = FULL-SIZE QR, RIGHT = BIG ROOM CODE + ATTENDEE NAMES */}
      <main className="flex-1 w-full h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 p-4 sm:p-6 md:p-8 lg:p-10 items-start justify-center max-w-[1700px] mx-auto overflow-y-auto">
        {/* LEFT COLUMN: FULL-SIZE MASSIVE QR CODE (md:col-span-6 lg:col-span-6) */}
        <div className="md:col-span-6 lg:col-span-6 flex flex-col items-center justify-center h-full my-auto">
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

        {/* RIGHT COLUMN: BIG ROOM CODE & ATTENDEE NAMES LIST (md:col-span-6 lg:col-span-6) */}
        <div className="md:col-span-6 lg:col-span-6 flex flex-col justify-start gap-4 sm:gap-5 h-full overflow-y-auto pr-1">
          {/* Header Subtitle */}
          <div>
            <div className="flex items-center gap-2 mb-1">
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
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isBrightMode ? 'text-slate-900' : 'text-white'
              }`}
            >
              Audience Stage Audio
            </h1>
          </div>

          {/* GIANT ROOM CODE DISPLAY BOX */}
          <div
            className={`w-full rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 transition-all border-2 shadow-xl ${
              isBrightMode
                ? 'bg-rose-50/70 border-rose-300 shadow-[0_12px_40px_rgba(225,29,72,0.1)]'
                : 'bg-[#0f141e] border-[#ef4444]/60 shadow-[0_0_40px_rgba(239,68,68,0.18)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-mono font-bold tracking-widest uppercase ${
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
            <div className="py-1 flex items-center justify-center">
              <span
                className={`font-mono font-black tracking-widest leading-none select-all text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl ${
                  isBrightMode
                    ? 'text-rose-700 drop-shadow-sm'
                    : 'text-[#ef4444] drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]'
                }`}
              >
                {roomCode}
              </span>
            </div>

            {/* Quick Actions Row: Copy Code & Copy Link */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-[#222834]">
              <button
                onClick={handleCopyCode}
                className={`py-1.5 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
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
                className={`py-1.5 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
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

          {/* ATTENDEES PRESENT IN MEETING CARD (SHOWS NAMES OF ATTENDEES) */}
          <div
            className={`w-full rounded-2xl p-4 border flex flex-col gap-3 shadow-md ${
              isBrightMode
                ? 'bg-white border-slate-200'
                : 'bg-[#10141c] border-[#222834]'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#222834]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10b981] text-[20px]">groups</span>
                <span
                  className={`text-xs font-mono font-bold tracking-wider uppercase ${
                    isBrightMode ? 'text-slate-900' : 'text-[#f1f5f9]'
                  }`}
                >
                  ATTENDEES PRESENT IN MEETING ({totalAttendeeCount})
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                ACTIVE ROSTER
              </span>
            </div>

            {/* List of Attendees with Names, Avatars, and Live States */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {displayMembers.length === 0 ? (
                <div
                  className={`py-8 px-4 text-center rounded-xl border border-dashed flex flex-col items-center justify-center ${
                    isBrightMode ? 'border-slate-300 bg-slate-50' : 'border-[#222834] bg-[#0c1017]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[#64748b] text-2xl mb-1">person_off</span>
                  <p className={`text-xs font-semibold ${isBrightMode ? 'text-slate-700' : 'text-[#94a3b8]'}`}>
                    No attendees connected yet
                  </p>
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    Participants who join room {roomCode} will appear here with live mic status
                  </p>
                </div>
              ) : (
                displayMembers.map((member) => {
                  const isSpeaker = currentSpeaker?.id === member.identity;
                  const queueIdx = queue.findIndex((q) => q.id === member.identity);
                  const isQueued = queueIdx !== -1;

                  return (
                    <div
                      key={member.identity}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        isSpeaker
                          ? 'bg-[#1c0f14] border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                          : isQueued
                          ? 'bg-[#1a1710] border-[#f59e0b]'
                          : isBrightMode
                          ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          : 'bg-[#141923] border-[#222834] hover:bg-[#181f2c]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar with Initials */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner flex-shrink-0"
                          style={{ backgroundColor: getAvatarColor(member.name) }}
                        >
                          {getInitials(member.name)}
                        </div>

                        {/* Attendee Name & Identity */}
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isBrightMode ? 'text-slate-900' : 'text-[#f1f5f9]'
                            }`}
                          >
                            {member.name}
                          </span>
                          <span className="text-[10px] font-mono text-[#94a3b8] truncate">
                            {member.identity.slice(0, 18)} • Connected
                          </span>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isSpeaker ? (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#ef4444] text-white font-bold flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            ON AIR
                          </span>
                        ) : isQueued ? (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#f59e0b] text-[#1a1000] font-bold">
                            QUEUE #{queueIdx + 1}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            CONNECTED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* DIRECT BROWSER ADDRESS BAR */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono ${
              isBrightMode
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-[#0a0d14] border-[#1e2534] text-[#94a3b8]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-[#38bdf8]">language</span>
              <span className="truncate select-all text-[#38bdf8] font-bold text-[11px]">
                {webTransmitterUrl}
              </span>
            </div>
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                isBrightMode ? 'bg-slate-100 text-slate-600' : 'bg-[#141923] text-[#64748b]'
              }`}
            >
              OPUS 48kHz
            </span>
          </div>

          {/* 3-STEP AUDIENCE GUIDE */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#ef4444]">
                <span>01</span>
                <span>SCAN QR</span>
              </div>
              <p className="text-[10px] leading-tight text-[#94a3b8]">
                Aim phone camera at QR code on left.
              </p>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#f59e0b]">
                <span>02</span>
                <span>REQUEST</span>
              </div>
              <p className="text-[10px] leading-tight text-[#94a3b8]">
                Tap &quot;Join Stage&quot; to queue for mic.
              </p>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                isBrightMode
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-[#0f141e] border-[#1e2534] text-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#10b981]">
                <span>03</span>
                <span>SPEAK</span>
              </div>
              <p className="text-[10px] leading-tight text-[#94a3b8]">
                Hold or tap button to speak to room.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
