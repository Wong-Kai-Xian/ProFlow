import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

// Watches project tasks and notifies assignees about due-soon/overdue items
export default function FollowUpAgent() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [];

    const listen = (q) => onSnapshot(q, async (snap) => {
      const settingsRef = doc(db, 'users', currentUser.uid, 'settings', 'notifications');
      let dueSoonMs = 24 * 60 * 60 * 1000;
      let enableOverdue = true;
      try {
        const s = await getDoc(settingsRef);
        if (s.exists()) {
          const d = s.data();
          if (typeof d.dueSoonHours === 'number') dueSoonMs = Math.max(1, Math.min(168, d.dueSoonHours)) * 60 * 60 * 1000;
          if (typeof d.enableOverdueAlerts === 'boolean') enableOverdue = d.enableOverdueAlerts;
        }
      } catch {}

      const now = Date.now();
      const seenKey = `proflow_task_followups_${currentUser.uid}`;
      const seenRaw = localStorage.getItem(seenKey);
      const seen = seenRaw ? JSON.parse(seenRaw) : {};
      let changed = false;

      for (const d of snap.docs) {
        const proj = d.data();
        const projectId = d.id;
        const sections = Array.isArray(proj.tasks) ? proj.tasks : [];
        for (const section of sections) {
          const tasks = Array.isArray(section?.tasks) ? section.tasks : [];
          for (const t of tasks) {
            const taskId = t.id || `${section.name || 'sec'}-${Math.random()}`;
            const title = t.title || t.name || 'Task';
            const assigned = (t.assignedTo || t.assignee || '').toString().toLowerCase();
            const meName = (currentUser.displayName || '').toLowerCase();
            const meEmail = (currentUser.email || '').toLowerCase();
            if (!assigned) continue;
            const isMine = assigned === meName || assigned === meEmail;
            if (!isMine) continue;
            if (!t.deadline) continue;
            const dt = new Date(`${t.deadline}T09:00`).getTime();
            if (!dt || Number.isNaN(dt)) continue;
            const timeTo = dt - now;

            if (timeTo <= dueSoonMs && timeTo >= 0) {
              const key = `task_due:${projectId}:${taskId}`;
              if (!seen[key]) {
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'project',
                    title: 'Task due soon',
                    message: `${title} • ${new Date(dt).toLocaleDateString()}`,
                    refType: 'upcomingEvent',
                    sourceId: projectId,
                    eventId: key
                  });
                  seen[key] = now;
                  changed = true;
                } catch {}
              }
            }

            if (enableOverdue && timeTo < 0) {
              const keyOver = `task_overdue:${projectId}:${taskId}`;
              if (!seen[keyOver]) {
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
                    unread: true,
                    createdAt: serverTimestamp(),
                    origin: 'project',
                    title: 'Task overdue',
                    message: `${title} • was due ${new Date(dt).toLocaleDateString()}`,
                    refType: 'upcomingEvent',
                    sourceId: projectId,
                    eventId: keyOver
                  });
                  seen[keyOver] = now;
                  changed = true;
                } catch {}
              }
            }
          }
        }
      }

      if (changed) localStorage.setItem(seenKey, JSON.stringify(seen));
    });

    // Projects owned by me
    unsubs.push(listen(query(collection(db, 'projects'), where('ownerId', '==', currentUser.uid))));
    // Projects where I'm on the team (by email)
    if (currentUser.email) {
      unsubs.push(listen(query(collection(db, 'projects'), where('team', 'array-contains', currentUser.email))));
    }
    // Legacy projects created by userId
    unsubs.push(listen(query(collection(db, 'projects'), where('userId', '==', currentUser.uid))));

    return () => unsubs.forEach(u => { try { u(); } catch {} });
  }, [currentUser]);

  return null;
}


