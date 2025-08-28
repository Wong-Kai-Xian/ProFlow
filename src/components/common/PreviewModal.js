import React from 'react';
import { createPortal } from 'react-dom';

export default function PreviewModal({ isOpen, onClose, file }) {
  if (!isOpen) return null;

  const isImage = file?.type === 'image' || (file?.mime && file.mime.startsWith('image/'));

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 4050, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', width: '92vw', height: '86vh', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>{file?.name || 'Preview'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {file?.url && (
              <button onClick={() => { try { navigator.clipboard.writeText(file.url); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Copy Link</button>
            )}
            <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>
        </div>
        <div style={{ flex: 1, background: '#f9fafb' }}>
          {isImage ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={file.url} alt={file?.name || 'image'} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </div>
          ) : file?.url ? (
            <iframe title={file?.name || 'File'} src={file.url} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>No preview available.</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}


