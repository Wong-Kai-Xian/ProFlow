import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AttachDriveFileModal({ isOpen, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('my'); // 'my' | 'shared' | 'all'

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
          scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
          prompt: 'none',
          callback: (resp) => resolve(resp?.access_token || null)
        });
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch { resolve(null); }
    });
  };

  const requestInteractiveToken = async () => {
    if (!clientId) return null;
    await loadScriptOnce('https://accounts.google.com/gsi/client');
    return await new Promise((resolve) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
          prompt: 'consent',
          callback: (resp) => resolve(resp?.access_token || null)
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch { resolve(null); }
    });
  };

  const loadFiles = async () => {
    setLoading(true);
    setError('');
    try {
      let token = await ensureDriveToken();
      if (!token) token = await requestInteractiveToken();
      if (!token) { setError('Authorization required.'); setLoading(false); return; }
      const base = new URL('https://www.googleapis.com/drive/v3/files');
      base.searchParams.set('orderBy', 'modifiedTime desc');
      base.searchParams.set('pageSize', '50');
      base.searchParams.set('fields', 'files(id,name,mimeType,webViewLink)');
      let q = "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation')";
      if (scope === 'shared') q = `sharedWithMe = true and ${q}`;
      base.searchParams.set('q', q);
      if (scope === 'all') {
        base.searchParams.set('includeItemsFromAllDrives', 'true');
        base.searchParams.set('supportsAllDrives', 'true');
        base.searchParams.set('corpora', 'allDrives');
      }
      const res = await fetch(base.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to list Drive files');
      const json = await res.json();
      setFiles(Array.isArray(json.files) ? json.files : []);
    } catch (e) {
      setError(e.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) { setFiles([]); setError(''); setQuery(''); return; }
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scope]);

  if (!isOpen) return null;

  const filtered = query ? files.filter(f => (f.name || '').toLowerCase().includes(query.toLowerCase())) : files;

  const toType = (mime) => (
    mime === 'application/vnd.google-apps.document' ? 'gdoc' :
    mime === 'application/vnd.google-apps.spreadsheet' ? 'gsheet' :
    mime === 'application/vnd.google-apps.presentation' ? 'gslide' : 'document'
  );

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 4100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 720, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>Attach from Google Drive</div>
          <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search by name..." style={{ flex: 1, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setScope('my')} style={{ padding: '6px 10px', borderRadius: 8, border: scope === 'my' ? '1px solid #111827' : '1px solid #e5e7eb', background: scope === 'my' ? '#f3f4f6' : '#fff', fontSize: 12 }}>My Drive</button>
            <button onClick={() => setScope('shared')} style={{ padding: '6px 10px', borderRadius: 8, border: scope === 'shared' ? '1px solid #111827' : '1px solid #e5e7eb', background: scope === 'shared' ? '#f3f4f6' : '#fff', fontSize: 12 }}>Shared with me</button>
            <button onClick={() => setScope('all')} style={{ padding: '6px 10px', borderRadius: 8, border: scope === 'all' ? '1px solid #111827' : '1px solid #e5e7eb', background: scope === 'all' ? '#f3f4f6' : '#fff', fontSize: 12 }}>All drives</button>
          </div>
        </div>
        <div style={{ padding: 12, flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ color: '#6b7280' }}>Loading files…</div>
          ) : error ? (
            <div style={{ color: '#b91c1c' }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No files found.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              {filtered.map(f => (
                <li key={f.id} style={{ display: 'contents' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {toType(f.mimeType) === 'gdoc' ? '📄' : toType(f.mimeType) === 'gsheet' ? '📊' : '📽️'} {f.name}
                  </div>
                  <div>
                    <button onClick={() => onSelect && onSelect({ name: f.name, type: toType(f.mimeType), driveId: f.id, url: f.webViewLink || (toType(f.mimeType) === 'gdoc' ? `https://docs.google.com/document/d/${f.id}/edit` : toType(f.mimeType) === 'gsheet' ? `https://docs.google.com/spreadsheets/d/${f.id}/edit` : `https://docs.google.com/presentation/d/${f.id}/edit`) })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12 }}>Attach</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


