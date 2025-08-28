import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FileActionsModal({ isOpen, onClose, file, onRename, onDelete, onShare, onOpen, onPreview, onCopyLink }) {
  const [newName, setNewName] = useState(file?.name || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNewName(file?.name || '');
    setCopied(false);
  }, [file, isOpen]);

  if (!isOpen) return null;

  const isGoogle = file && (file.type === 'gdoc' || file.type === 'gsheet' || file.type === 'gslide');

  const handleCopy = async () => {
    try { if (file?.url) { await navigator.clipboard.writeText(file.url); setCopied(true); setTimeout(() => setCopied(false), 1200); } } catch {}
    if (onCopyLink) onCopyLink(file?.url || '');
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 480, maxWidth: '94vw', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: 14, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>Edit File</div>
          <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>Name</div>
            <input value={newName} onChange={(e)=>setNewName(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isGoogle ? (
              <button onClick={() => onOpen && onOpen(file)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12 }}>Open</button>
            ) : (
              file?.url && <button onClick={() => onPreview && onPreview(file)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12 }}>Preview</button>
            )}
            {file?.url && (
              <button onClick={handleCopy} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: copied ? '#ecfdf5' : '#fff', fontSize: 12 }}>{copied ? 'Copied' : 'Copy Link'}</button>
            )}
            {isGoogle && (
              <button onClick={() => onShare && onShare(file)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12 }}>Share</button>
            )}
          </div>
        </div>
        <div style={{ padding: 14, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => onDelete && onDelete(file)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#b91c1c', fontSize: 12 }}>Delete</button>
          <button onClick={() => onRename && onRename(file, newName)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #111827', background: '#111827', color: '#fff', fontSize: 12 }}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}


