import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DriveShareModal({ isOpen, onClose, file }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('anyone'); // 'anyone' | 'user'
  const [role, setRole] = useState('reader'); // 'reader' | 'commenter' | 'writer'
  const [email, setEmail] = useState('');
  const [expireEnabled, setExpireEnabled] = useState(false);
  const [expireAt, setExpireAt] = useState(''); // datetime-local
  const clientId = useMemo(() => localStorage.getItem('google_oauth_client_id') || '', []);

  const loadScriptOnce = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src)); document.head.appendChild(s);
  });

  const ensureDriveToken = async () => {
    if (!clientId) return null;
    await loadScriptOnce('https://accounts.google.com/gsi/client');
    return await new Promise((resolve) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
          prompt: 'none',
          callback: (resp) => resolve(resp?.access_token || null)
        });
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch { resolve(null); }
    });
  };

  useEffect(() => {
    if (!isOpen) { setError(''); setMode('anyone'); setRole('reader'); setEmail(''); setExpireEnabled(false); setExpireAt(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const onConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      if (!file?.driveId) { setError('Missing file ID'); setLoading(false); return; }
      let token = await ensureDriveToken();
      if (!token) { setError('Authorization required.'); setLoading(false); return; }
      const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.driveId}/permissions`);
      url.searchParams.set('supportsAllDrives', 'true');
      if (mode === 'user') url.searchParams.set('sendNotificationEmail', 'true');

      const body = { role, type: mode === 'anyone' ? 'anyone' : 'user' };
      if (mode === 'user') body.emailAddress = email.trim();
      if (mode === 'anyone') body.allowFileDiscovery = false;
      if (expireEnabled && expireAt) {
        try { body.expirationTime = new Date(expireAt).toISOString(); } catch {}
      }

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { throw new Error('Failed to set sharing permission'); }

      // Fetch link and copy
      let link = file.url || '';
      try {
        const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.driveId}?fields=webViewLink&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
        if (getRes.ok) {
          const j = await getRes.json();
          if (j.webViewLink) link = j.webViewLink;
        }
      } catch {}
      try { await navigator.clipboard.writeText(link); } catch {}
      // Toast instead of alert
      try {
        const toast = document.createElement('div');
        toast.textContent = 'Share updated. Link copied';
        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.bottom = '28px';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = '#111827';
        toast.style.color = '#fff';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '10px';
        toast.style.fontSize = '12px';
        toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
        toast.style.zIndex = '5000';
        document.body.appendChild(toast);
        setTimeout(() => { try { toast.style.opacity = '0'; toast.style.transition = 'opacity 300ms'; } catch {} }, 1400);
        setTimeout(() => { try { document.body.removeChild(toast); } catch {} }, 1750);
      } catch {}
      onClose && onClose();
    } catch (e) {
      setError(e.message || 'Failed to update sharing');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4150, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '94vw', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>Share "{file?.name || 'File'}"</div>
          <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('anyone')} style={{ padding: '6px 10px', borderRadius: 8, border: mode === 'anyone' ? '1px solid #111827' : '1px solid #e5e7eb', background: mode === 'anyone' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Anyone with link</button>
            <button onClick={() => setMode('user')} style={{ padding: '6px 10px', borderRadius: 8, border: mode === 'user' ? '1px solid #111827' : '1px solid #e5e7eb', background: mode === 'user' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Invite user</button>
          </div>
          {mode === 'user' && (
            <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="user@example.com" style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          )}
          <div>
            <label style={{ fontSize: 12, color: '#374151' }}>Role</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => setRole('reader')} style={{ padding: '6px 10px', borderRadius: 8, border: role === 'reader' ? '1px solid #111827' : '1px solid #e5e7eb', background: role === 'reader' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Viewer</button>
              <button onClick={() => setRole('commenter')} style={{ padding: '6px 10px', borderRadius: 8, border: role === 'commenter' ? '1px solid #111827' : '1px solid #e5e7eb', background: role === 'commenter' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Commenter</button>
              <button onClick={() => setRole('writer')} style={{ padding: '6px 10px', borderRadius: 8, border: role === 'writer' ? '1px solid #111827' : '1px solid #e5e7eb', background: role === 'writer' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Editor</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input id="exp-toggle" type="checkbox" checked={expireEnabled} onChange={(e)=>setExpireEnabled(e.target.checked)} />
            <label htmlFor="exp-toggle" style={{ fontSize: 12, color: '#374151' }}>Set expiration</label>
          </div>
          {expireEnabled && (
            <input type="datetime-local" value={expireAt} onChange={(e)=>setExpireAt(e.target.value)} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          )}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #111827', background: '#111827', color: '#fff', cursor: 'pointer', fontSize: 12 }}>{loading ? 'Saving...' : 'Save & Copy Link'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


