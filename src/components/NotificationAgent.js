import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

// Invisible agent that triggers approval reminders/escalations via notifications
export default function NotificationAgent() {
  const { currentUser } = useAuth();
  const gmailIntervalRef = useRef(null);

  const loadScriptOnce = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Failed to load ' + src)); document.head.appendChild(s);
  });

  const ensureGmailToken = async () => {
    const clientId = localStorage.getItem('google_oauth_client_id') || '';
    if (!clientId) return null;
    await loadScriptOnce('https://accounts.google.com/gsi/client');
    return await new Promise((resolve) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          prompt: '',
          callback: (resp) => resolve(resp?.access_token || null)
        });
        tokenClient.requestAccessToken();
      } catch { resolve(null); }
    });
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubs = [];
    // Lightweight Gmail new mail poller -> notify center
    const startGmailPoll = async () => {
      try {
        const accessToken = await ensureGmailToken();
        if (!accessToken) return;
        let lastIds = new Set(JSON.parse(localStorage.getItem(`proflow_gmail_seen_${currentUser.uid}`) || '[]'));
        const poll = async () => {
          try {
            const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok) return;
            const json = await res.json();
            const msgs = Array.isArray(json.messages) ? json.messages : [];
            const nowSeen = new Set(msgs.map(m => m.id));
            for (const m of msgs) {
              if (!lastIds.has(m.id)) {
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'gmail',
                    title: 'New email received',
                    message: 'You have a new email in your inbox',
                    refType: 'gmail',
                    gmailMessageId: m.id,
                  });
                } catch {}
              }
            }
            localStorage.setItem(`proflow_gmail_seen_${currentUser.uid}`, JSON.stringify(Array.from(nowSeen)));
            lastIds = nowSeen;
          } catch {}
        };
        await poll();
        gmailIntervalRef.current = setInterval(poll, 60000); // 1 minute
      } catch {}
    };
    startGmailPoll();
    // Invitations to me -> notify
    const qInvIncoming = query(collection(db, 'invitations'), where('toUserId', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsubIncoming = onSnapshot(qInvIncoming, async (snap) => {
      for (const d of snap.docs) {
        const key = `inv_in:${d.id}`;
        const seenKey = `proflow_inv_${currentUser.uid}`;
        const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
        if (!seen[key]) {
          try {
            await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'team',
              title: 'New team invitation',
              message: 'You received a team invitation',
              refType: 'invitation',
              invitationId: d.id,
            });
            seen[key] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
          } catch {}
        }
      }
    });

    // Invitations I sent accepted -> notify me and auto-link
    const qInvAccepted = query(collection(db, 'invitations'), where('fromUserId', '==', currentUser.uid), where('status', 'in', ['accepted']));
    const unsubAccepted = onSnapshot(qInvAccepted, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        const key = `inv_acc:${d.id}`;
        const seenKey = `proflow_inv_${currentUser.uid}`;
        const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
        if (!seen[key]) {
          try {
            await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'team',
              title: 'Invitation accepted',
              message: `${data.toUserEmail || 'Someone'} accepted your invitation`,
              refType: 'invitation',
              invitationId: d.id,
            });
            seen[key] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
          } catch {}
        }
        // Auto-link team membership bidirectionally once (idempotent via 'linked' flag)
        try {
          if (!data.linked && data.toUserId) {
            await addDoc(collection(db, 'users', currentUser.uid, 'connections'), { with: data.toUserId, status: 'accepted', createdAt: serverTimestamp() });
            await addDoc(collection(db, 'users', data.toUserId, 'connections'), { with: currentUser.uid, status: 'accepted', createdAt: serverTimestamp() });
            await updateDoc(doc(db, 'invitations', d.id), { linked: true, linkedAt: serverTimestamp() });
          }
        } catch {}
      }
    });

    // Invitations I received and accepted -> auto-link and notify me
    const qInvAcceptedToMe = query(collection(db, 'invitations'), where('toUserId', '==', currentUser.uid), where('status', 'in', ['accepted']))
    const unsubAcceptedToMe = onSnapshot(qInvAcceptedToMe, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        const key = `inv_acc_me:${d.id}`;
        const seenKey = `proflow_inv_${currentUser.uid}`;
        const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
        if (!seen[key]) {
          try {
            await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'team',
              title: 'Connection added',
              message: `You are now connected with ${data.fromUserEmail || 'a teammate'}`,
              refType: 'invitation',
              invitationId: d.id,
            });
            seen[key] = Date.now();
            localStorage.setItem(seenKey, JSON.stringify(seen));
          } catch {}
        }
        try {
          if (!data.linked && data.fromUserId) {
            await addDoc(collection(db, 'users', currentUser.uid, 'connections'), { with: data.fromUserId, status: 'accepted', createdAt: serverTimestamp() });
            await addDoc(collection(db, 'users', data.fromUserId, 'connections'), { with: currentUser.uid, status: 'accepted', createdAt: serverTimestamp() });
            await updateDoc(doc(db, 'invitations', d.id), { linked: true, linkedAt: serverTimestamp() });
          }
        } catch {}
      }
    });
    const q = query(collection(db, 'approvalRequests'), where('requestedTo', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, async (snap) => {
      const now = Date.now();
      const seenKey = `proflow_approvals_${currentUser.uid}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seen = seenRaw ? JSON.parse(seenRaw) : {};
      let changed = false;
      for (const d of snap.docs) {
        const data = d.data();
        const t = data.dateRequested?.toMillis?.() || data.timestamp?.toMillis?.() || data.createdAt?.toMillis?.();
        if (!t) continue;
        const elapsed = now - t;
        // Due date notifications for approver
        if (data.dueDate) {
          const due = new Date(`${data.dueDate}T${(data.dueTime && data.dueTime.trim()) ? data.dueTime : '09:00'}`).getTime();
          if (due) {
            const timeToDue = due - now;
            if (timeToDue <= 24*60*60*1000 && timeToDue >= 0) {
              const key = `appr_due:${d.id}`;
              if (!seen[key]) {
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'approval',
                    title: 'Approval due soon',
                    message: `${data.requestTitle || data.projectName || 'Approval'} • ${new Date(due).toLocaleString()}`,
                    refType: 'approval',
                    approvalId: d.id,
                  });
                  seen[key] = now;
                  changed = true;
                } catch {}
              }
            }
            if (timeToDue < 0) {
              const keyOver = `appr_overdue:${d.id}`;
              if (!seen[keyOver]) {
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'approval',
                    title: 'Approval overdue',
                    message: `${data.requestTitle || data.projectName || 'Approval'} was due ${new Date(due).toLocaleString()}`,
                    refType: 'approval',
                    approvalId: d.id,
                  });
                  seen[keyOver] = now;
                  changed = true;
                } catch {}
              }
            }
          }
        }
        // 24h reminder to decision maker
        if (elapsed > 24 * 60 * 60 * 1000) {
          const key = `dm_reminder:${d.id}`;
          if (!seen[key]) {
            try {
              await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                unread: true,
                createdAt: serverTimestamp(),
                origin: 'approval',
                title: 'Approval pending',
                message: `${data.requestedByName || 'Requester'} is awaiting your decision${data.requestTitle ? ` • ${data.requestTitle}` : ''}`,
                refType: 'approval',
                approvalId: d.id,
              });
              seen[key] = now;
              changed = true;
            } catch {}
          }
        }
        // 72h escalation to viewers (nudge observers)
        if (elapsed > 72 * 60 * 60 * 1000 && Array.isArray(data.viewers) && data.viewers.length > 0) {
          for (const vid of data.viewers) {
            const key = `dm_escalate_viewer:${d.id}:${vid}`;
            if (!seen[key]) {
              try {
                await addDoc(collection(db, 'users', vid, 'notifications'), {
                  unread: true,
                  createdAt: serverTimestamp(),
                  origin: 'approval',
                  title: 'Approval still pending',
                  message: `${data.requestedToName || 'Assignee'} has not decided${data.requestTitle ? ` • ${data.requestTitle}` : ''}`,
                  refType: 'approval',
                  approvalId: d.id,
                });
                seen[key] = now;
                changed = true;
              } catch {}
            }
          }
        }
      }
      if (changed) localStorage.setItem(seenKey, JSON.stringify(seen));
    });
    // Invoice due soon / overdue across my projects
    try {
      const qp = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
      const unsubProjects = onSnapshot(qp, (projSnap) => {
        const seenKey = `proflow_invoices_${currentUser.uid}`;
        const seenRaw = localStorage.getItem(seenKey);
        const seen = seenRaw ? JSON.parse(seenRaw) : {};
        const now = Date.now();
        projSnap.docs.forEach(projectDoc => {
          try {
            const pid = projectDoc.id;
            const unsubInv = onSnapshot(collection(db, 'projects', pid, 'invoices'), async (invSnap) => {
              for (const d of invSnap.docs) {
                const data = d.data();
                if (data.status === 'paid') continue;
                const dueStr = data.dueDate;
                if (!dueStr) continue;
                const due = new Date(`${dueStr}T09:00`).getTime();
                if (!due) continue;
                const delta = due - now;
                // Load user settings for due soon
                let dueSoonMs = 24 * 60 * 60 * 1000;
                try {
                  // lightweight cache per effect run via localStorage (already handled in NotificationCenter save)
                  const notifSettingsRaw = localStorage.getItem(`proflow_notif_settings_${currentUser.uid}`);
                  if (notifSettingsRaw) {
                    const ns = JSON.parse(notifSettingsRaw);
                    if (typeof ns.dueSoonHours === 'number') dueSoonMs = Math.max(1, Math.min(168, ns.dueSoonHours)) * 60 * 60 * 1000;
                  }
                } catch {}
                if (delta <= dueSoonMs && delta >= 0) {
                  const key = `inv_due:${pid}:${d.id}`;
                  if (!seen[key]) {
                    try {
                      await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                        unread: true,
                        createdAt: serverTimestamp(),
                        origin: 'invoice',
                        title: 'Invoice due soon',
                        message: `${data.client || 'Client'} • ${new Date(due).toLocaleDateString()}`,
                        refType: 'invoice',
                        sourceId: pid,
                        invoiceId: d.id
                      });
                      seen[key] = now;
                      localStorage.setItem(seenKey, JSON.stringify(seen));
                    } catch {}
                  }
                }
                if (delta < 0) {
                  const keyOver = `inv_over:${pid}:${d.id}`;
                  if (!seen[keyOver]) {
                    try {
                      await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                        unread: true,
                        createdAt: serverTimestamp(),
                        origin: 'invoice',
                        title: 'Invoice overdue',
                        message: `${data.client || 'Client'} • was due ${new Date(due).toLocaleDateString()}`,
                        refType: 'invoice',
                        sourceId: pid,
                        invoiceId: d.id
                      });
                      seen[keyOver] = now;
                      localStorage.setItem(seenKey, JSON.stringify(seen));
                    } catch {}
                  }
                }
              }
            });
            unsubs.push(unsubInv);
          } catch {}
        });
      });
      unsubs.push(unsubProjects);
    } catch {}

    return () => { try { unsub(); unsubIncoming(); unsubAccepted(); unsubAcceptedToMe(); } catch {}; unsubs.forEach(u => { try { u(); } catch {} }); if (gmailIntervalRef.current) { try { clearInterval(gmailIntervalRef.current); } catch {} } };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'approvalRequests'), where('requestedBy', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, async (snap) => {
      const now = Date.now();
      const seenKey = `proflow_approvals_${currentUser.uid}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seen = seenRaw ? JSON.parse(seenRaw) : {};
      let changed = false;
      for (const d of snap.docs) {
        const data = d.data();
        const t = data.dateRequested?.toMillis?.() || data.timestamp?.toMillis?.() || data.createdAt?.toMillis?.();
        if (!t) continue;
        const elapsed = now - t;
        // 48h escalation reminder to requester
        if (elapsed > 48 * 60 * 60 * 1000) {
          const key = `rq_escalate:${d.id}`;
          if (!seen[key]) {
            try {
              await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                unread: true,
                createdAt: serverTimestamp(),
                origin: 'approval',
                title: 'Approval still pending',
                message: `${data.requestedToName || 'Assignee'} has not responded${data.requestTitle ? ` • ${data.requestTitle}` : ''}`,
                refType: 'approval',
                approvalId: d.id,
              });
              seen[key] = now;
              changed = true;
            } catch {}
          }
        }
        // 72h notify viewers to increase visibility
        if (elapsed > 72 * 60 * 60 * 1000 && Array.isArray(data.viewers) && data.viewers.length > 0) {
          for (const vid of data.viewers) {
            const key = `rq_escalate_viewer:${d.id}:${vid}`;
            if (!seen[key]) {
              try {
                await addDoc(collection(db, 'users', vid, 'notifications'), {
                  unread: true,
                  createdAt: serverTimestamp(),
                  origin: 'approval',
                  title: 'Approval still pending',
                  message: `${data.requestedToName || 'Assignee'} has not decided${data.requestTitle ? ` • ${data.requestTitle}` : ''}`,
                  refType: 'approval',
                  approvalId: d.id,
                });
                seen[key] = now;
                changed = true;
              } catch {}
            }
          }
        }
      }
      if (changed) localStorage.setItem(seenKey, JSON.stringify(seen));
    });
    return () => unsub();
  }, [currentUser]);

  return null;
}


