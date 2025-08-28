import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, limit as qlimit } from 'firebase/firestore';

// Invisible agent that triggers approval reminders/escalations via notifications
export default function NotificationAgent() {
  const { currentUser } = useAuth();
  const gmailIntervalRef = useRef(null);
  const gmailStartedRef = useRef(false);
  const gmailLastRefreshRef = useRef(0);

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
          prompt: 'none',
          callback: (resp) => resolve(resp?.access_token || null)
        });
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch { resolve(null); }
    });
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubs = [];
    // Lightweight Gmail new mail poller -> notify center
    const startGmailPoll = async () => {
      if (gmailStartedRef.current || window.__proflow_gmail_poll_started) return;
      // Cooldown to prevent repeated token requests on route changes if not authorized
      try {
        const until = Number(window.__proflow_gmail_fail_until || 0);
        if (until && Date.now() < until) return;
      } catch {}
      // Only start if opted-in (default opt-in). If not authorized yet, attempt silent auth.
      let isOptIn = localStorage.getItem('gmail_poll_enabled');
      if (isOptIn !== '1') { try { localStorage.setItem('gmail_poll_enabled', '1'); } catch {} }
      const isAuthorizedFlag = localStorage.getItem('gmail_authorized') === '1';
      // Try silent token regardless of flag; if success, mark authorized
      let accessToken = await ensureGmailToken();
      if (accessToken) { try { localStorage.setItem('gmail_authorized', '1'); } catch {} }
      if (!accessToken) {
        try { window.__proflow_gmail_fail_until = Date.now() + 10 * 60 * 1000; } catch {}
        return;
      }
      try {
        gmailStartedRef.current = true;
        window.__proflow_gmail_poll_started = true;
        const seenKey = `proflow_gmail_seen_${currentUser.uid}`;
        const initKey = `proflow_gmail_seen_init_${currentUser.uid}`;
        let lastIds = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
        let initialized = (localStorage.getItem(initKey) === '1');
        const poll = async () => {
          try {
            // Throttle silent refresh: at most once every 45 minutes
            try {
              const nowTs = Date.now();
              if ((nowTs - (gmailLastRefreshRef.current || 0)) > (45 * 60 * 1000)) {
                const refreshed = await ensureGmailToken();
                if (refreshed) {
                  accessToken = refreshed;
                  gmailLastRefreshRef.current = nowTs;
                }
              }
            } catch {}
            const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!res.ok) return;
            const json = await res.json();
            const msgs = Array.isArray(json.messages) ? json.messages : [];
            if (msgs.length === 0) { return; }
            const nowSeen = new Set(msgs.map(m => m.id));
            // Initialize baseline without notifying existing emails
            if (!initialized) {
              localStorage.setItem(seenKey, JSON.stringify(Array.from(nowSeen)));
              localStorage.setItem(initKey, '1');
              initialized = true;
              lastIds = nowSeen;
              return;
            }
            // Compute truly new IDs only
            const addedIds = [];
            nowSeen.forEach(id => { if (!lastIds.has(id)) addedIds.push(id); });
            // If we somehow have no baseline stored but the init flag was true, re-baseline silently
            if (initialized && lastIds.size === 0 && nowSeen.size > 0) {
              localStorage.setItem(seenKey, JSON.stringify(Array.from(nowSeen)));
              lastIds = nowSeen;
            } else {
              for (const id of addedIds) {
                try {
                  // Dedupe: skip if a notification for this gmailMessageId already exists
                  const dupQ = query(
                    collection(db, 'users', currentUser.uid, 'notifications'),
                    where('origin', '==', 'gmail'),
                    where('gmailMessageId', '==', id),
                    qlimit(1)
                  );
                  const dup = await getDocs(dupQ);
                  if (!dup.empty) { continue; }
                  // Fetch minimal headers to determine counterpart email (From/To)
                  let customerEmail = '';
                  try {
                    const det = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To`, { headers: { Authorization: `Bearer ${accessToken}` } });
                    if (det.ok) {
                      const dj = await det.json();
                      const headers = dj?.payload?.headers || [];
                      const from = (headers.find(h => (h.name||'').toLowerCase()==='from')?.value || '').toLowerCase();
                      const to = (headers.find(h => (h.name||'').toLowerCase()==='to')?.value || '').toLowerCase();
                      const extract = (s) => {
                        const m = s.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
                        return m ? m[0] : '';
                      };
                      const f = extract(from);
                      const t = extract(to);
                      const me = (currentUser?.email || '').toLowerCase();
                      if (f && f !== me) customerEmail = f; else if (t && t !== me) customerEmail = t; else customerEmail = f || t || '';
                    }
                  } catch {}
                  // Resolve customerId by email
                  let customerId = '';
                  try {
                    if (customerEmail) {
                      const cq = query(collection(db, 'customerProfiles'), where('email', '==', customerEmail), qlimit(1));
                      const cs = await getDocs(cq);
                      if (!cs.empty) customerId = cs.docs[0].id;
                    }
                  } catch {}
                  // Optionally attach customer email if derivable later
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'gmail',
                    title: 'New email received',
                    message: 'You have a new email in your inbox',
                    refType: 'gmail',
                    gmailMessageId: id,
                    customerEmail,
                    customerId
                  });
                } catch {}
              }
            }
            localStorage.setItem(seenKey, JSON.stringify(Array.from(nowSeen)));
            lastIds = nowSeen;
          } catch {}
        };
        // Delay initial poll slightly to avoid doing it immediately on route change mounts
        const start = () => { try { poll(); } catch {} };
        gmailIntervalRef.current = setInterval(poll, 60000); // 1 minute
        setTimeout(start, 5000);
      } catch {}
    };
    startGmailPoll();

    // Toast only for new gmail notifications; suppress first snapshot
    try {
      const notifCol = collection(db, 'users', currentUser.uid, 'notifications');
      let seededToasts = false;
      const seenToastIds = new Set();
      let lastToastAt = 0;
      const unsubToasts = onSnapshot(notifCol, (snap) => {
        try {
          if (!seededToasts) {
            snap.docs.forEach(d => seenToastIds.add(d.id));
            seededToasts = true;
            return;
          }
          const added = snap.docChanges().filter(ch => ch.type === 'added');
          if (added.length === 0) return;
          added.forEach(ch => {
            const id = ch.doc.id;
            const last = ch.doc.data();
            if (seenToastIds.has(id)) return;
            // Dedupe double-emits shortly after mount
            seenToastIds.add(id);
            if (last.origin !== 'gmail') return; // only toast gmail arrivals
            // Rate limit toasts (avoid bursts on route change): 1 toast per 1.5s
            const now = Date.now();
            if (now - lastToastAt < 1500) return;
            lastToastAt = now;
            const rootId = 'global-toast-root';
            let root = document.getElementById(rootId);
            if (!root) {
              root = document.createElement('div');
              root.id = rootId;
              root.style.position = 'fixed';
              root.style.top = '16px';
              root.style.right = '16px';
              root.style.zIndex = 2147483647;
              document.body.appendChild(root);
            }
            const el = document.createElement('div');
            el.style.marginTop = '8px';
            el.style.background = '#111827';
            el.style.color = '#fff';
            el.style.padding = '10px 12px';
            el.style.borderRadius = '10px';
            el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '8px';
            el.innerHTML = `<span>📬</span><div><div style="font-weight:700;font-size:13px;">${(last.title||'New email')}</div><div style=\"font-size:12px;opacity:0.85;\">${(last.message||'')}</div></div>`;
            root.appendChild(el);
            setTimeout(() => { try { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; } catch {} }, 2000);
            setTimeout(() => { try { root.removeChild(el); } catch {} }, 2400);
          });
        } catch {}
      });
      unsubs.push(unsubToasts);
    } catch {}

    // Incoming customer shares → notify receiver
    try {
      const sharesBase = collection(db, 'customerShares');
      const qToUid = query(sharesBase, where('toUserId', '==', currentUser.uid), where('status', '==', 'pending'));
      const unsubSharesUid = onSnapshot(qToUid, async (snap) => {
        const seenKey = `proflow_share_in_${currentUser.uid}`;
        const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
        for (const d of snap.docs) {
          const key = `share_in:${d.id}`;
          if (!seen[key]) {
            try {
              const data = d.data();
              const who = data.fromUserEmail || 'Someone';
              await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                unread: true,
                createdAt: serverTimestamp(),
                origin: 'customer',
                title: 'Incoming customer share',
                message: `${who} shared a customer with you`,
                refType: 'customerShare',
                shareId: d.id,
              });
              seen[key] = Date.now();
              localStorage.setItem(seenKey, JSON.stringify(seen));
            } catch {}
          }
        }
      });
      unsubs.push(unsubSharesUid);

      if (currentUser.email) {
        const qToEmail = query(sharesBase, where('toUserEmail', '==', currentUser.email), where('status', '==', 'pending'));
        const unsubSharesEmail = onSnapshot(qToEmail, async (snap) => {
          const seenKey = `proflow_share_in_${currentUser.uid}`;
          const seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
          for (const d of snap.docs) {
            const key = `share_in:${d.id}`;
            if (!seen[key]) {
              try {
                const data = d.data();
                const who = data.fromUserEmail || 'Someone';
                await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                  unread: true,
                  createdAt: serverTimestamp(),
                  origin: 'customer',
                  title: 'Incoming customer share',
                  message: `${who} shared a customer with you`,
                  refType: 'customerShare',
                  shareId: d.id,
                });
                seen[key] = Date.now();
                localStorage.setItem(seenKey, JSON.stringify(seen));
              } catch {}
            }
          }
        });
        unsubs.push(unsubSharesEmail);
      }
    } catch {}
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


