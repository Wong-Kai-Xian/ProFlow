import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { DESIGN_SYSTEM } from '../styles/designSystem';

export default function NotificationCenter({ userId, isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [dueSoonHours, setDueSoonHours] = useState(24);
  const [enableOverdueAlerts, setEnableOverdueAlerts] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!userId || !isOpen) return;
    const q = query(collection(db, 'users', userId, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(list);
    });
    return () => unsub();
  }, [userId, isOpen]);

  useEffect(() => {
    if (!userId || !isOpen) return;
    const load = async () => {
      try {
        const ref = doc(db, 'users', userId, 'settings', 'notifications');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.dueSoonHours === 'number') setDueSoonHours(d.dueSoonHours);
          if (typeof d.enableOverdueAlerts === 'boolean') setEnableOverdueAlerts(d.enableOverdueAlerts);
        }
      } catch {}
    };
    load();
  }, [userId, isOpen]);

  const markAsRead = async (id) => {
    if (!userId || !id) return;
    try { await updateDoc(doc(db, 'users', userId, 'notifications', id), { unread: false }); } catch {}
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    const unread = items.filter(n => n.unread);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'users', userId, 'notifications', n.id), { unread: false }))).catch(() => {});
  };

  const handleNavigate = (n) => {
    try {
      if (!n) return;
      if (n.unread) { markAsRead(n.id); }
      if (n.refType === 'upcomingEvent') {
        if (n.origin === 'project' && n.sourceId) navigate(`/project/${n.sourceId}`);
        else if (n.origin === 'customer' && n.sourceId) navigate(`/customer/${n.sourceId}`);
        else if (n.origin === 'forum' && n.sourceId) navigate(`/forum/${n.sourceId}`);
      } else if (n.refType === 'mention') {
        if (n.origin === 'forum' && n.forumId) {
          if (n.postId) navigate(`/forum/${n.forumId}#post-${n.postId}`);
          else navigate(`/forum/${n.forumId}`);
        } else if (n.origin === 'customer' && n.customerId) {
          navigate(`/customer/${n.customerId}`);
        } else if (n.origin === 'task' && n.projectId) {
          navigate(`/project/${n.projectId}`);
        }
      } else if (n.refType === 'approval') {
        navigate('/approvals');
      }
      // Fallback: do nothing
    } catch {}
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 3000, display: 'flex', justifyContent: 'flex-end', paddingRight: 16 }} onClick={onClose}>
      <div style={{ width: 360, maxWidth: '90vw', background: DESIGN_SYSTEM.colors.background.primary, color: DESIGN_SYSTEM.colors.text.primary, height: '85vh', marginTop: '7.5vh', boxShadow: DESIGN_SYSTEM.shadows.lg, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 12, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold, fontSize: DESIGN_SYSTEM.typography.fontSize.base }}>Notifications</div>
            <button onClick={onClose} style={{ padding: '6px 10px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Close</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => setShowUnreadOnly(v => !v)} style={{ padding: '6px 8px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: showUnreadOnly ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>{showUnreadOnly ? 'Show all' : 'Show unread'}</button>
            <button onClick={() => setShowSettings(v => !v)} style={{ padding: '6px 8px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: showSettings ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Settings</button>
            <button onClick={markAllAsRead} style={{ padding: '6px 8px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Mark all read</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {['all','approvals','events'].map(key => (
                <button key={key} onClick={() => setFilterType(key)} style={{ padding: '6px 8px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: filterType === key ? DESIGN_SYSTEM.colors.secondary[100] : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}>{key === 'events' ? 'Events' : key}</button>
              ))}
            </div>
          </div>
        </div>
        {showSettings && (
          <div style={{ padding: 12, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}` }}>
            <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Notification rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, color: DESIGN_SYSTEM.colors.text.secondary }}>
                Due soon window (hours)
                <input type="number" min={1} max={168} value={dueSoonHours} onChange={(e) => setDueSoonHours(Number(e.target.value || 24))} style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: DESIGN_SYSTEM.colors.text.secondary }}>
                <input type="checkbox" checked={enableOverdueAlerts} onChange={(e) => setEnableOverdueAlerts(e.target.checked)} /> Enable overdue alerts
              </label>
              <div>
                <button onClick={async () => { try { await setDoc(doc(db, 'users', userId, 'settings', 'notifications'), { dueSoonHours, enableOverdueAlerts, updatedAt: Date.now() }); setShowSettings(false); } catch {} }} style={{ padding: '6px 10px', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 6, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Save</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
          {(() => {
            const list = (items || [])
              .filter(n => (showUnreadOnly ? n.unread : true))
              .filter(n => filterType === 'all' || (filterType === 'approvals' && n.refType === 'approval') || (filterType === 'events' && n.refType === 'upcomingEvent'));
            if (list.length === 0) {
              return <div style={{ color: '#6b7280', padding: 12 }}>No notifications</div>;
            }
            return list.map(n => (
              <div key={n.id} onClick={() => handleNavigate(n)} style={{ padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 8, marginBottom: 8, background: n.unread ? DESIGN_SYSTEM.colors.background.secondary : DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer' }}>
                <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 4 }}>{n.title || 'Notification'}</div>
                {n.message && <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, marginBottom: 6 }}>{n.message}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: DESIGN_SYSTEM.colors.text.tertiary }}>
                  <span>{n.origin || 'system'}</span>
                  <span>{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ''}</span>
                </div>
                {n.unread && (
                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => markAsRead(n.id)} style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer' }}>Mark as read</button>
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}


