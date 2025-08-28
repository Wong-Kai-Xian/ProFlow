import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function GoogleEmbedModal({ isOpen, onClose, fileType, driveId, title = '' }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    try { window.addEventListener('keydown', onKey); } catch {}
    return () => { try { window.removeEventListener('keydown', onKey); } catch {} };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getEmbedUrl = () => {
    if (!driveId) return '';
    switch (fileType) {
      case 'gdoc':
        return `https://docs.google.com/document/d/${driveId}/edit?rm=minimal&embedded=true`;
      case 'gsheet':
        return `https://docs.google.com/spreadsheets/d/${driveId}/edit?rm=minimal&embedded=true`;
      case 'gslide':
        return `https://docs.google.com/presentation/d/${driveId}/embed?start=false&loop=false&delayms=3000`;
      default:
        return '';
    }
  };

  const url = getEmbedUrl();

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: '92vw', height: '86vh', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>{title || 'Google File'}</div>
          <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
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


