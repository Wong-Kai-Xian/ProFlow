import React, { useEffect, useMemo, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import CatAvatar from './shared/CatAvatar';

export default function PersonalAssistant() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [forums, setForums] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [userMap, setUserMap] = useState({}); // uid -> name/email
  const [forumPostsMap, setForumPostsMap] = useState({}); // forumId -> [titles]
  const [forumPostsDetailMap, setForumPostsDetailMap] = useState({}); // forumId -> [{title, body, authorUid}]
  const [queryText, setQueryText] = useState('');
  const [summary, setSummary] = useState('');
  const [history, setHistory] = useState([]); // {q,a,timestamp}
  const [apiKey, setApiKey] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [showKeyEditor, setShowKeyEditor] = useState(true);

  // Drag position (fixed, left/top in px)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);

  // Init API key and persisted UI state
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) { setApiKey(savedKey); setShowKeyEditor(false); }
    const savedPos = localStorage.getItem('pa_pos');
    if (savedPos) {
      try { setPos(JSON.parse(savedPos)); } catch {}
    }
    const savedOpen = localStorage.getItem('pa_is_open');
    if (savedOpen === '1') setIsOpen(true);
    const savedHist = localStorage.getItem('pa_history');
    if (savedHist) {
      try { setHistory(JSON.parse(savedHist)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pa_is_open', isOpen ? '1' : '0');
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('pa_history', JSON.stringify(history.slice(-50)));
  }, [history]);

  // Initialize position: bottom-right by default if not set
  useLayoutEffect(() => {
    if (!pos || (pos.x === 0 && pos.y === 0)) {
      const margin = 20;
      const defaultX = Math.max(0, (window.innerWidth || 360) - (56 + margin));
      const defaultY = Math.max(0, (window.innerHeight || 800) - (56 + margin));
      setPos({ x: defaultX, y: defaultY });
    }
  }, []);

  // Persist position
  useEffect(() => {
    localStorage.setItem('pa_pos', JSON.stringify(pos));
  }, [pos]);

  const clamp = useCallback((x, y) => {
    const maxX = Math.max(0, (window.innerWidth || 360) - 56);
    const maxY = Math.max(0, (window.innerHeight || 800) - 56);
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
  }, []);

  const startDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    setDragOffset({ x: startX - pos.x, y: startY - pos.y });
    setDragging(true);
    setDragMoved(false);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const nx = e.clientX - dragOffset.x;
      const ny = e.clientY - dragOffset.y;
      const c = clamp(nx, ny);
      if (Math.abs(nx - pos.x) > 2 || Math.abs(ny - pos.y) > 2) setDragMoved(true);
      setPos(c);
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, dragOffset, clamp, pos.x, pos.y]);

  // Load projects owned or joined
  useEffect(() => {
    if (!currentUser?.uid) return;
    const ownedQ = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
    const teamQ = query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid));
    const unsubOwned = onSnapshot(ownedQ, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        items.forEach(it => map.set(it.id, it));
        return Array.from(map.values());
      });
    });
    const unsubTeam = onSnapshot(teamQ, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        items.forEach(it => map.set(it.id, it));
        return Array.from(map.values());
      });
    });
    return () => { unsubOwned(); unsubTeam(); };
  }, [currentUser?.uid]);

  // Load forums where user is a member
  useEffect(() => {
    if (!currentUser?.uid) return;
    const memberQ = query(collection(db, 'forums'), where('members', 'array-contains', currentUser.uid));
    const unsub = onSnapshot(memberQ, snap => {
      setForums(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser?.uid]);

  // Load approvals relevant to user (requester or recipient)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const reqQ = query(collection(db, 'approvalRequests'), where('requesterUid', '==', currentUser.uid));
    const recQ = query(collection(db, 'approvalRequests'), where('recipients', 'array-contains', currentUser.uid));
    const unsubReq = onSnapshot(reqQ, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovals(prev => {
        const map = new Map(prev.map(a => [a.id, a]));
        items.forEach(it => map.set(it.id, it));
        return Array.from(map.values());
      });
    });
    const unsubRec = onSnapshot(recQ, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setApprovals(prev => {
        const map = new Map(prev.map(a => [a.id, a]));
        items.forEach(it => map.set(it.id, it));
        return Array.from(map.values());
      });
    });
    return () => { unsubReq(); unsubRec(); };
  }, [currentUser?.uid]);

  // Enrich user names for project teams
  useEffect(() => {
    const uids = new Set();
    projects.forEach(p => (Array.isArray(p.team) ? p.team.forEach(uid => uids.add(uid)) : null));
    const all = Array.from(uids);
    if (all.length === 0) { setUserMap({}); return; }
    const chunkSize = 10;
    let cancelled = false;
    (async () => {
      const nextMap = {};
      for (let i = 0; i < all.length; i += chunkSize) {
        const chunk = all.slice(i, i + chunkSize);
        try {
          const qUsers = query(collection(db, 'users'), where('uid', 'in', chunk));
          const snap = await getDocs(qUsers);
          snap.forEach(doc => {
            const d = doc.data();
            nextMap[d.uid || doc.id] = d.name || d.email || 'Member';
          });
        } catch {}
      }
      if (!cancelled) setUserMap(nextMap);
    })();
    return () => { cancelled = true; };
  }, [projects]);

  // Load recent posts for forums (best-effort)
  useEffect(() => {
    const ids = forums.map(f => f.id);
    if (ids.length === 0) { setForumPostsMap({}); setForumPostsDetailMap({}); return; }
    const chunkSize = 10;
    let cancelled = false;
    (async () => {
      const map = {};
      const dmap = {};
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        try {
          const qPosts = query(collection(db, 'posts'), where('forumId', 'in', chunk));
          const snap = await getDocs(qPosts);
          snap.forEach(d => {
            const p = d.data();
            const fid = p.forumId;
            map[fid] = map[fid] || [];
            dmap[fid] = dmap[fid] || [];
            if (p.title) map[fid].push(p.title);
            dmap[fid].push({ title: p.title || 'Untitled', body: (p.content || p.body || '').slice(0, 400), authorUid: p.authorUid || p.userId || '' });
          });
        } catch {}
      }
      if (!cancelled) { setForumPostsMap(map); setForumPostsDetailMap(dmap); }
    })();
    return () => { cancelled = true; };
  }, [forums]);

  // Utility: simple output sanitizer for AI responses
  const cleanText = useCallback((text) => {
    if (!text) return '';
    let t = text;
    // Normalize bullets and remove heavy markdown symbols
    t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')); // drop fences
    t = t.replace(/^\s*#\s*/gm, '');
    t = t.replace(/^\s*[-*•●▪▫]+\s*/gm, '• ');
    t = t.replace(/\*\*(.*?)\*\*/g, '$1');
    t = t.replace(/__(.*?)__/g, '$1');
    t = t.replace(/\s*\n\s*\n\s*/g, '\n\n');
    return t.trim();
  }, []);

  const insights = useMemo(() => {
    const projectCount = projects.length;
    const forumCount = forums.length;
    const activeProjects = projects.filter(p => p.stage && p.stage !== 'Completed');
    const approvalsPending = approvals.filter(a => a.status === 'pending').length;
    const myTasks = projects.flatMap(project => {
      const sections = Array.isArray(project.tasks) ? project.tasks : [];
      return sections.flatMap(section => Array.isArray(section?.tasks)
        ? section.tasks.map(t => ({ ...t, projectId: project.id, projectName: project.name || 'Untitled', stage: section?.stage }))
        : []
      );
    });
    // Upcoming deadlines in next 14 days
    const now = new Date();
    const soon = new Date(); soon.setDate(now.getDate() + 14);
    const upcoming = projects.filter(p => p.deadline).filter(p => {
      const d = new Date(p.deadline);
      return d >= now && d <= soon;
    }).map(p => ({ name: p.name || 'Untitled', deadline: p.deadline }));
    return { projectCount, forumCount, activeProjects, approvalsPending, myTasks, upcoming };
  }, [projects, forums, approvals]);

  async function callGemini(prompt, context) {
    const key = apiKey || '';
    if (!key) throw new Error('Missing GEMINI API key');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const body = { contents: [{ role: 'user', parts: [{ text: JSON.stringify({ context, question: prompt }) }] }] };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || 'No answer.';
    return text;
  }

  const handleAsk = async () => {
    const q = queryText.trim();
    if (!q) {
      const base = `Projects: ${insights.projectCount} • Forums: ${insights.forumCount} • Active: ${insights.activeProjects.length} • Approvals pending: ${insights.approvalsPending}`;
      setSummary(base);
      setHistory(h => [...h, { q: '(overview)', a: base, t: Date.now() }]);
      return;
    }
    const projectsContext = projects.slice(0, 8).map(p => ({
      id: p.id,
      name: p.name || 'Untitled',
      stage: p.stage || 'N/A',
      deadline: p.deadline || 'N/A',
      description: (p.description || '').slice(0, 600),
      members: (Array.isArray(p.team) ? p.team : []).map(uid => userMap[uid] || uid),
      tasks: (Array.isArray(p.tasks) ? p.tasks : []).slice(0, 6).flatMap(s => Array.isArray(s.tasks) ? s.tasks.slice(0, 6).map(t => ({ title: t.title || t.name || 'Task', status: t.status || 'open', deadline: t.deadline || '', stage: s.stage || '' })) : [])
    }));
    const forumsContext = forums.slice(0, 12).map(f => ({
      id: f.id,
      name: f.name || 'Untitled',
      postsCount: f.posts || 0,
      recentPosts: (forumPostsDetailMap[f.id] || []).slice(0, 5).map(p => ({ title: p.title, excerpt: p.body, author: userMap[p.authorUid] || p.authorUid }))
    }));
    const ctx = {
      user: currentUser?.email || currentUser?.uid || 'unknown',
      approvalsPending: insights.approvalsPending,
      upcomingDeadlines: insights.upcoming.slice(0, 10),
      projects: projectsContext,
      forums: forumsContext,
      tasksSample: insights.myTasks.slice(0, 20).map(t => ({ title: t.title || t.name || 'Task', project: t.projectName, status: t.status || 'open', stage: t.stage || '' }))
    };
    try {
      setIsCalling(true);
      const answer = await callGemini(q, ctx);
      setSummary(cleanText(answer));
      setHistory(h => [...h, { q, a: cleanText(answer), t: Date.now() }]);
    } catch (err) {
      const msg = `AI error: ${err.message}`;
      setSummary(msg);
      setHistory(h => [...h, { q, a: msg, t: Date.now() }]);
    } finally {
      setIsCalling(false);
    }
  };

  const handleSaveKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    setShowKeyEditor(false);
  };

  const quickAsk = (q) => {
    setQueryText(q);
    setTimeout(() => handleAsk(), 0);
  };

  const launcher = (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 2147483647 }}>
      {!isOpen && (
        <div onMouseDown={startDrag} onClick={(e) => { if (dragMoved) { e.preventDefault(); return; } setIsOpen(true); }} title="Personal Assistant" style={{ lineHeight: 0 }}>
          <CatAvatar size={76} fluffy={true} noBackground={true} />
        </div>
      )}
    </div>
  );

  const panel = isOpen && (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 2147483647, width: 380, maxWidth: 'calc(100vw - 32px)' }}>
      <div style={{ background: '#ffffff', borderRadius: 16, boxShadow: '0 24px 48px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '72vh', border: '1px solid #e5e7eb' }}>
        <div onMouseDown={startDrag} style={{ padding: 12, background: 'linear-gradient(135deg,#0f172a,#1e293b)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move' }}>
          <div style={{ fontWeight: 700 }}>Personal Assistant</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 10, padding: '4px 10px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
        <div style={{ padding: 10, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#334155' }}>Projects: {insights.projectCount} • Forums: {insights.forumCount} • Active: {insights.activeProjects.length} • Approvals: {insights.approvalsPending}</div>
          {!showKeyEditor && (
            <button onClick={() => setShowKeyEditor(true)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Edit API Key</button>
          )}
        </div>
        {showKeyEditor && (
          <div style={{ padding: 10, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste GEMINI_API_KEY" style={{ flex: 1, padding: 8, borderRadius: 10, border: '1px solid #e5e7eb', outline: 'none' }} />
            <button onClick={handleSaveKey} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #0f172a', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>Save</button>
          </div>
        )}
        <div style={{ padding: 12, gap: 8, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Ask about projects, forums, deadlines, tasks..." style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', outline: 'none' }} />
            <button disabled={isCalling} onClick={handleAsk} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #0f172a', background: isCalling ? '#64748b' : '#0f172a', color: '#fff', cursor: isCalling ? 'not-allowed' : 'pointer' }}>{isCalling ? 'Thinking…' : 'Ask'}</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => quickAsk('List my upcoming deadlines in the next 14 days.')} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Upcoming deadlines</button>
            <button onClick={() => quickAsk('Which projects have the most open tasks?')} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Open tasks</button>
            <button onClick={() => quickAsk('Summarize recent forum activity.')} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Forum summary</button>
          </div>
          {summary && (
            <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 12, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{summary}</div>
          )}
          {history.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, margin: '6px 0' }}>Recent</div>
              <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 160, overflowY: 'auto' }}>
                {history.slice(-10).reverse().map((h, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: '#475569' }}>Q: {h.q}</div>
                    <div style={{ fontSize: 12, color: '#0f172a' }}>A: {h.a.slice(0, 200)}{h.a.length > 200 ? '…' : ''}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(launcher, document.body)}
      {panel && createPortal(panel, document.body)}
    </>
  );
}
