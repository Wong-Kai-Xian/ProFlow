import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { DESIGN_SYSTEM, getButtonStyle } from '../../styles/designSystem';

export default function IncomingCustomerSharesModal({ isOpen, onClose }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const base = collection(db, 'customerShares');
        const qByUid = query(base, where('toUserId', '==', currentUser.uid), where('status', '==', 'pending'));
        const qByEmail = currentUser.email ? query(base, where('toUserEmail', '==', currentUser.email), where('status', '==', 'pending')) : null;
        const [snapUid, snapEmail] = await Promise.all([
          getDocs(qByUid),
          qByEmail ? getDocs(qByEmail) : Promise.resolve({ docs: [] })
        ]);
        const seen = new Set();
        const list = [];
        const pushDoc = async (d) => {
          if (seen.has(d.id)) return; seen.add(d.id);
          const data = d.data();
          let fromUserName = data.fromUserEmail || 'User';
          if (data.fromUserId) {
            try {
              const usnap = await getDoc(doc(db, 'users', data.fromUserId));
              if (usnap.exists()) {
                const u = usnap.data();
                fromUserName = u.name || u.email || fromUserName;
              }
            } catch {}
          }
          list.push({ id: d.id, ...data, fromUserName });
        };
        for (const d of snapUid.docs) { await pushDoc(d); }
        for (const d of snapEmail.docs) { await pushDoc(d); }
        setItems(list);
      } finally {
        setLoading(false);
      }
    };
    if (isOpen) load();
  }, [isOpen, currentUser]);

  const handleAction = async (it, action) => {
    if (!currentUser || processing) return;
    setProcessing(it.id);
    try {
      // Update share status
      const shareRef = doc(db, 'customerShares', it.id);
      const updatePayload = { status: action, actedAt: serverTimestamp() };
      if (!it.toUserId) updatePayload.toUserId = currentUser.uid;
      await updateDoc(shareRef, updatePayload);
      if (action === 'accepted' && it.customerId) {
        // Grant access: add current user to access array on customer profile
        const cref = doc(db, 'customerProfiles', it.customerId);
        await updateDoc(cref, { access: arrayUnion(currentUser.uid) });
        // Notify sender
        try {
          if (it.fromUserId) {
            await addDoc(collection(db, 'users', it.fromUserId, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'customer',
              title: 'Share accepted',
              message: `${currentUser.email || 'User'} accepted your customer share`,
              refType: 'invitation',
              customerId: it.customerId,
            });
          }
        } catch {}
      }
      setItems(prev => prev.filter(x => x.id !== it.id));
    } catch (e) {
      alert('Failed to process.');
    } finally {
      setProcessing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: DESIGN_SYSTEM.colors.background.primary, color: DESIGN_SYSTEM.colors.text.primary, width: '92%', maxWidth: 560, borderRadius: 12, boxShadow: DESIGN_SYSTEM.shadows.lg }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Incoming Customer Shares</div>
          <button onClick={onClose} style={{ ...getButtonStyle('secondary', 'customers') }}>Close</button>
        </div>
        <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, color: DESIGN_SYSTEM.colors.text.secondary }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16, color: DESIGN_SYSTEM.colors.text.secondary }}>No pending shares</div>
          ) : (
            items.map((it) => (
              <div key={it.id} style={{ border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>{it.customerName || 'Customer Profile'}</div>
                <div style={{ fontSize: 13, color: DESIGN_SYSTEM.colors.text.secondary, marginTop: 4 }}>From: {it.fromUserName}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button disabled={processing === it.id} onClick={() => handleAction(it, 'accepted')} style={{ ...getButtonStyle('primary', 'customers'), opacity: processing === it.id ? 0.6 : 1 }}>Accept</button>
                  <button disabled={processing === it.id} onClick={() => handleAction(it, 'rejected')} style={{ ...getButtonStyle('secondary', 'customers'), opacity: processing === it.id ? 0.6 : 1 }}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


