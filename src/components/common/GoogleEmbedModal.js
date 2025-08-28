import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export default function GoogleEmbedModal({ isOpen, onClose, fileType, driveId, title = '' }) {
  const [mode, setMode] = useState('embed'); // 'embed' | 'edit'
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    try { window.addEventListener('keydown', onKey); } catch {}
    return () => { try { window.removeEventListener('keydown', onKey); } catch {} };
  }, [isOpen, onClose]);

  const urls = useMemo(() => {
    if (!driveId) return { embed: '', edit: '' };
    if (fileType === 'gdoc') {
      return {
        embed: `https://docs.google.com/document/d/${driveId}/edit?rm=minimal&embedded=true`,
        edit: `https://docs.google.com/document/d/${driveId}/edit`
      };
    }
    if (fileType === 'gsheet') {
      return {
        embed: `https://docs.google.com/spreadsheets/d/${driveId}/edit?rm=minimal&embedded=true`,
        edit: `https://docs.google.com/spreadsheets/d/${driveId}/edit`
      };
    }
    if (fileType === 'gslide') {
      return {
        embed: `https://docs.google.com/presentation/d/${driveId}/embed?start=false&loop=false&delayms=3000`,
        edit: `https://docs.google.com/presentation/d/${driveId}/edit`
      };
    }
    return { embed: '', edit: '' };
  }, [fileType, driveId]);

  if (!isOpen) return null;

  const url = mode === 'embed' ? urls.embed : urls.edit;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: '92vw', height: '86vh', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || 'Google File'}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, background: '#f3f4f6', padding: 4, borderRadius: 9999 }}>
              <button onClick={() => setMode('embed')} style={{ padding: '6px 10px', borderRadius: 9999, border: '1px solid #e5e7eb', background: mode === 'embed' ? '#fff' : 'transparent', fontSize: 12 }}>View</button>
              <button onClick={() => setMode('edit')} style={{ padding: '6px 10px', borderRadius: 9999, border: '1px solid #e5e7eb', background: mode === 'edit' ? '#fff' : 'transparent', fontSize: 12 }}>Full editor</button>
            </div>
            {urls.edit && (
              <a href={urls.edit} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12 }}>Open in Google</a>
            )}
            <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>
        </div>
        <div style={{ flex: 1, background: '#f9fafb' }}>
          {url ? (
            <iframe title={title || 'Google File'} src={url} style={{ width: '100%', height: '100%', border: 'none' }} allow="clipboard-read; clipboard-write; fullscreen" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>Missing or invalid file.</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


