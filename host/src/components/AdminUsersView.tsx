import React, { useState, useEffect } from 'react';
import { AuthUser, AdminUserSummary, AuditLogEntry } from '../auth/types';

interface AdminUsersViewProps {
  currentUser: AuthUser;
  tokenServerUrl: string;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  currentUser,
  tokenServerUrl,
}) => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'storage'>('users');
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/admin/users`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setStorageLocation(data.storageLocation || '/server/data/users.json');
        setFileSizeBytes(data.fileSizeBytes || 0);
        setLastModified(data.lastModified || null);
      }

      // Also fetch audit logs
      const logsRes = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/admin/audit-logs`, {
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('[AdminUsersView] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [tokenServerUrl, currentUser.token]);

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'operator') => {
    try {
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/admin/users/${userId}/role`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setActionMessage({ text: `Successfully updated user role to ${newRole}`, type: 'success' });
        fetchAdminData();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Failed to update role', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Network error updating role', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userEmail === currentUser.email) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently revoke user ${userEmail}?`)) {
      return;
    }

    try {
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/admin/users/${userId}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentUser.token}`,
        },
      });

      if (res.ok) {
        setActionMessage({ text: `User ${userEmail} has been deleted`, type: 'success' });
        fetchAdminData();
      } else {
        setActionMessage({ text: 'Failed to delete user', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Network error deleting user', type: 'error' });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleCopyPath = () => {
    if (storageLocation) {
      navigator.clipboard.writeText(storageLocation);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2500);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#222834]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[26px] text-red-500">admin_panel_settings</span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Administrator Control Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-600/20 text-red-400 border border-red-500/30">
              ROOT ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage registered operators, Google-authenticated accounts, and inspect disk storage.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181d28] hover:bg-[#202534] border border-[#272e3b] text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Banner / Feedback Notice */}
      {actionMessage && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/80 border-red-500/30 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {actionMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ─── CARD 1: Storage Location Diagnostic (Answers: "Where is it stored?") ─── */}
      <div className="p-5 rounded-2xl bg-[#0f1217] border border-[#222834] shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-amber-400">database</span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Database &amp; Persistent File Storage
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SYNCHRONIZED TO DISK
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          All user authentication accounts, Google credentials, roles, and audit trails are persistently stored on the server filesystem in high-performance JSON datastores. Passwords are encrypted using OWASP standard <strong className="text-slate-200 font-mono">scrypt</strong> with 16-byte random salts.
        </p>

        {/* Path highlight box */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#080a0e] border border-[#1e2430]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-slate-500 flex-shrink-0">folder_open</span>
            <code className="text-xs font-mono text-amber-300 truncate selection:bg-amber-500 selection:text-black">
              {storageLocation || 'server/data/users.json'}
            </code>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopyPath}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#181d28] hover:bg-[#222838] text-[11px] font-mono text-slate-300 font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copiedPath ? 'check' : 'content_copy'}
              </span>
              <span>{copiedPath ? 'COPIED' : 'COPY PATH'}</span>
            </button>
          </div>
        </div>

        {/* Storage Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1 pt-3 border-t border-[#181d28] text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[10px]">TOTAL ACCOUNTS</span>
            <span className="text-white font-bold text-sm">{users.length} Users</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">DATABASE FILE SIZE</span>
            <span className="text-white font-bold text-sm">{(fileSizeBytes / 1024).toFixed(2)} KB</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">LAST DISK WRITE</span>
            <span className="text-amber-300 font-bold text-sm">
              {lastModified ? new Date(lastModified).toLocaleTimeString() : 'Synchronized'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">AUTH ENCRYPTION</span>
            <span className="text-emerald-400 font-bold text-sm">scrypt + HMAC</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">AUDIT EVENTS</span>
            <span className="text-blue-400 font-bold text-sm">{auditLogs.length} Records</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Users Directory / Security Audit Trail */}
      <div className="flex border-b border-[#222834]">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-red-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          <span>Registered Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-red-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Security Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* ─── TAB 1: USERS DIRECTORY ─── */}
      {activeTab === 'users' && (
        <div className="overflow-x-auto rounded-2xl border border-[#222834] bg-[#0f1217] shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141822] text-slate-400 font-mono text-[11px] uppercase border-b border-[#222834]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2430]">
              {users.map((u) => {
                const isCurrent = u.email === currentUser.email;
                return (
                  <tr key={u.id} className="hover:bg-[#141822]/60 transition-colors">
                    {/* User Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {u.picture ? (
                          <img
                            src={u.picture}
                            alt={u.fullName}
                            className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center font-bold text-xs font-mono">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-600 text-white font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Auth Provider */}
                    <td className="py-3.5 px-4">
                      {u.authProvider === 'google' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                          <svg className="w-3 h-3" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                          </svg>
                          GOOGLE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
                          <span className="material-symbols-outlined text-[12px] text-slate-400">key</span>
                          PASSWORD
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {u.role}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Last Login */}
                    <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString() : 'Never'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Role Switcher */}
                        {u.role === 'operator' ? (
                          <button
                            onClick={() => handleUpdateRole(u.id, 'admin')}
                            title="Promote to Administrator"
                            className="px-2.5 py-1 rounded bg-[#181d28] hover:bg-red-600/20 text-slate-300 hover:text-red-400 border border-[#272e3b] text-[10px] font-mono font-bold uppercase transition-colors"
                          >
                            Make Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateRole(u.id, 'operator')}
                            disabled={isCurrent}
                            title="Demote to Operator"
                            className="px-2.5 py-1 rounded bg-[#181d28] hover:bg-slate-700 text-slate-400 hover:text-white border border-[#272e3b] text-[10px] font-mono uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Set Operator
                          </button>
                        )}

                        {/* Delete User */}
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Cannot delete self' : 'Revoke user account'}
                          className="p-1.5 rounded bg-[#181d28] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#272e3b] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB 2: SECURITY AUDIT TRAIL ─── */}
      {activeTab === 'audit' && (
        <div className="overflow-x-auto rounded-2xl border border-[#222834] bg-[#0f1217] shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141822] text-slate-400 font-mono text-[11px] uppercase border-b border-[#222834]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Target Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2430]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    No security events logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#141822]/60 transition-colors font-mono text-[11px]">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#181d28] text-slate-200 font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">
                      {log.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default AdminUsersView;
