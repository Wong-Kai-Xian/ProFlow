import React, { useEffect, useMemo, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import CatAvatar from './shared/CatAvatar';
import { DESIGN_SYSTEM } from '../styles/designSystem';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function PersonalAssistant() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [forums, setForums] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [userMap, setUserMap] = useState({}); // uid -> name/email
  const [forumPostsMap, setForumPostsMap] = useState({}); // forumId -> [titles]
  const [forumPostsDetailMap, setForumPostsDetailMap] = useState({}); // forumId -> [{title, body, authorUid}]
  const [queryText, setQueryText] = useState('');
  const [summary, setSummary] = useState('');
  const [history, setHistory] = useState([]); // {q,a,timestamp}
  const [apiKey, setApiKey] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [showKeyEditor, setShowKeyEditor] = useState(true);
  const [stagedFile, setStagedFile] = useState(null); // { file, name, size }

  // Drag position (fixed, left/top in px)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);

  // Inject gradient animation keyframes once
  useEffect(() => {
    const id = 'pa-gradient-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.innerHTML = `@keyframes paGradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`;
      document.head.appendChild(style);
    }
  }, []);

  // Dynamic theming
  const fontStack = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";
  const headerGradient = 'linear-gradient(120deg, #ff6a00, #ee0979, #7b4397, #00c6ff, #00ff95, #fffb00, #ff6a00)';

  // Black button styles
  const blackBtn = { background: '#0f172a', color: '#fff', border: '1px solid #0f172a', borderRadius: 10, cursor: 'pointer' };
  const blackBtnSecondary = { background: '#111827', color: '#fff', border: '1px solid #0f172a', borderRadius: 10, cursor: 'pointer' };
  const blackBtnOutline = { background: '#fff', color: '#0f172a', border: '1px solid #0f172a', borderRadius: 999, cursor: 'pointer' };

  // Init persisted state
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) { setApiKey(savedKey); setShowKeyEditor(false); }
    const savedPos = localStorage.getItem('pa_pos');
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        const nx = Number(parsed?.x);
        const ny = Number(parsed?.y);
        if (Number.isFinite(nx) && Number.isFinite(ny)) {
          setPos({ x: nx, y: ny });
        }
      } catch {}
    }
    const savedOpen = localStorage.getItem('pa_is_open');
    if (savedOpen === '1') setIsOpen(true);
    const savedHist = localStorage.getItem('pa_history');
    if (savedHist) {
      try { setHistory(JSON.parse(savedHist)); } catch {}
    }
  }, []);
  useEffect(() => { localStorage.setItem('pa_is_open', isOpen ? '1' : '0'); }, [isOpen]);
  useEffect(() => { localStorage.setItem('pa_history', JSON.stringify(history.slice(-50))); }, [history]);

  // Default bottom-right
  useLayoutEffect(() => {
    if (!pos || (pos.x === 0 && pos.y === 0)) {
      const margin = DESIGN_SYSTEM.spacing.base || 16;
      const defaultX = Math.max(0, (window.innerWidth || 360) - (76 + margin));
      const defaultY = Math.max(0, (window.innerHeight || 800) - (76 + margin));
      setPos({ x: defaultX, y: defaultY });
    }
  }, []);
  useEffect(() => { localStorage.setItem('pa_pos', JSON.stringify(pos)); }, [pos]);

  const clamp = useCallback((x, y) => {
    const maxX = Math.max(0, (window.innerWidth || 360) - 76);
    const maxY = Math.max(0, (window.innerHeight || 800) - 76);
    const nx = Number.isFinite(x) ? x : 0;
    const ny = Number.isFinite(y) ? y : 0;
    return { x: Math.min(Math.max(0, nx), maxX), y: Math.min(Math.max(0, ny), maxY) };
  }, []);
  const startDrag = (e) => { e.preventDefault(); const startX = e.clientX, startY = e.clientY; setDragOffset({ x: startX - pos.x, y: startY - pos.y }); setDragging(true); setDragMoved(false); };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => { const nx = e.clientX - dragOffset.x; const ny = e.clientY - dragOffset.y; const c = clamp(nx, ny); if (Math.abs(nx - pos.x) > 2 || Math.abs(ny - pos.y) > 2) setDragMoved(true); setPos(c); };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, dragOffset, clamp, pos.x, pos.y]);

  // Data subscriptions (unchanged details omitted for brevity)
  useEffect(() => { if (!currentUser?.uid) return; const ownedQ = query(collection(db, 'projects'), where('userId', '==', currentUser.uid)); const teamQ = query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid)); const u1 = onSnapshot(ownedQ, s => { const items = s.docs.map(d => ({ id: d.id, ...d.data() })); setProjects(p => { const m = new Map(p.map(i => [i.id, i])); items.forEach(it => m.set(it.id, it)); return Array.from(m.values()); }); }); const u2 = onSnapshot(teamQ, s => { const items = s.docs.map(d => ({ id: d.id, ...d.data() })); setProjects(p => { const m = new Map(p.map(i => [i.id, i])); items.forEach(it => m.set(it.id, it)); return Array.from(m.values()); }); }); return () => { u1(); u2(); }; }, [currentUser?.uid]);
  useEffect(() => { if (!currentUser?.uid) return; const qf = query(collection(db, 'forums'), where('members', 'array-contains', currentUser.uid)); return onSnapshot(qf, s => setForums(s.docs.map(d => ({ id: d.id, ...d.data() })))); }, [currentUser?.uid]);
  useEffect(() => { if (!currentUser?.uid) return; const r1 = query(collection(db, 'approvalRequests'), where('requesterUid', '==', currentUser.uid)); const r2 = query(collection(db, 'approvalRequests'), where('recipients', 'array-contains', currentUser.uid)); const u1 = onSnapshot(r1, s => { const items = s.docs.map(d => ({ id: d.id, ...d.data() })); setApprovals(a => { const m = new Map(a.map(i => [i.id, i])); items.forEach(it => m.set(it.id, it)); return Array.from(m.values()); }); }); const u2 = onSnapshot(r2, s => { const items = s.docs.map(d => ({ id: d.id, ...d.data() })); setApprovals(a => { const m = new Map(a.map(i => [i.id, i])); items.forEach(it => m.set(it.id, it)); return Array.from(m.values()); }); }); return () => { u1(); u2(); }; }, [currentUser?.uid]);
  useEffect(() => { if (!currentUser?.uid) return; try { const cq = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser.uid)); return onSnapshot(cq, s => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })))); } catch { setCustomers([]); } }, [currentUser?.uid]);
  useEffect(() => { const uids = new Set(); projects.forEach(p => (Array.isArray(p.team) ? p.team.forEach(uid => uids.add(uid)) : null)); const all = Array.from(uids); if (all.length === 0) { setUserMap({}); return; } const chunk = 10; let cancelled = false; (async () => { const nm = {}; for (let i = 0; i < all.length; i += chunk) { const slice = all.slice(i, i + chunk); try { const qu = query(collection(db, 'users'), where('uid', 'in', slice)); const snap = await getDocs(qu); snap.forEach(doc => { const d = doc.data(); nm[d.uid || doc.id] = d.name || d.email || 'Member'; }); } catch {} } if (!cancelled) setUserMap(nm); })(); return () => { cancelled = true; }; }, [projects]);
  useEffect(() => { const ids = forums.map(f => f.id); if (ids.length === 0) { setForumPostsMap({}); setForumPostsDetailMap({}); return; } const chunk = 10; let cancelled = false; (async () => { const map = {}, dmap = {}; for (let i = 0; i < ids.length; i += chunk) { const slice = ids.slice(i, i + chunk); try { const qp = query(collection(db, 'posts'), where('forumId', 'in', slice)); const snap = await getDocs(qp); snap.forEach(d => { const p = d.data(); const fid = p.forumId; map[fid] = map[fid] || []; dmap[fid] = dmap[fid] || []; if (p.title) map[fid].push(p.title); dmap[fid].push({ title: p.title || 'Untitled', body: (p.content || p.body || '').slice(0, 400), authorUid: p.authorUid || p.userId || '' }); }); } catch {} } if (!cancelled) { setForumPostsMap(map); setForumPostsDetailMap(dmap); } })(); return () => { cancelled = true; }; }, [forums]);

  const cleanText = useCallback((text) => { if (!text) return ''; let t = text; t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')); t = t.replace(/^\s*#\s*/gm, ''); t = t.replace(/^\s*[-*•●▪▫]+\s*/gm, '• '); t = t.replace(/\*\*(.*?)\*\*/g, '$1'); t = t.replace(/__(.*?)__/g, '$1'); t = t.replace(/\s*\n\s*\n\s*/g, '\n\n'); return t.trim(); }, []);

  const insights = useMemo(() => {
    const projectCount = projects.length, forumCount = forums.length, customerCount = customers.length;
    const activeProjects = projects.filter(p => p.stage && p.stage !== 'Completed');
    const approvalsPending = approvals.filter(a => a.status === 'pending').length;
    const myTasks = projects.flatMap(project => { const sections = Array.isArray(project.tasks) ? project.tasks : []; return sections.flatMap(section => Array.isArray(section?.tasks) ? section.tasks.map(t => ({ ...t, projectId: project.id, projectName: project.name || 'Untitled', stage: section?.stage })) : []); });
    const now = new Date(); const soon = new Date(); soon.setDate(now.getDate() + 14);
    const upcoming = projects.filter(p => p.deadline).filter(p => { const d = new Date(p.deadline); return d >= now && d <= soon; }).map(p => ({ name: p.name || 'Untitled', deadline: p.deadline }));
    let customerNotes = 0, customerReminders = 0, customerFiles = 0; customers.forEach(c => { const sd = c.stageData || {}; Object.keys(sd).forEach(k => { const n = Array.isArray(sd[k]?.notes) ? sd[k].notes.length : 0; customerNotes += n; }); customerReminders += Array.isArray(c.reminders) ? c.reminders.length : 0; customerFiles += Array.isArray(c.files) ? c.files.length : 0; });
    return { projectCount, forumCount, customerCount, activeProjects, approvalsPending, myTasks, upcoming, customerNotes, customerReminders, customerFiles };
  }, [projects, forums, approvals, customers]);

  async function callGemini(prompt, context) {
    const key = apiKey || ''; if (!key) throw new Error('Missing GEMINI API key');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const attachments = Array.isArray(context.attachments) ? context.attachments : [];
    const attachmentsText = attachments.map((a, idx) => {
      const header = `Attachment ${idx + 1}: ${a.name || 'file'} (${Math.round((a.size||0)/1024)} KB)\nURL: ${a.url || ''}`;
      const content = (a.content || '').slice(0, 20000);
      return `${header}${content ? `\nContent (truncated):\n\n\`\`\`\n${content}\n\`\`\`` : ''}`;
    }).join('\n\n');
    const promptText = [
      'You are a helpful assistant. Use the attachments and context when relevant. If attachments are provided, prefer their content.',
      `Question:\n${prompt}`,
      attachmentsText ? `\n\nAttachments:\n${attachmentsText}` : '',
      `\n\nContext (JSON):\n${JSON.stringify({ ...context, attachments: undefined })}`
    ].join('');
    const body = { contents: [{ role: 'user', parts: [{ text: promptText }] }] };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text()); const data = await res.json();
    const answerText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || 'No answer.'; return answerText;
  }

  const handleAsk = async (attachments = []) => {
    let q = queryText.trim();
    if (!q && attachments.length > 0) {
      q = 'Summarize the attached file(s) and extract key points and actions.';
    }
    if (!q) { const base = `Projects: ${insights.projectCount} • Forums: ${insights.forumCount} • Customers: ${insights.customerCount} • Active projects: ${insights.activeProjects.length} • Approvals pending: ${insights.approvalsPending}`; setSummary(base); setHistory(h => [...h, { q: '(overview)', a: base, t: Date.now(), attachments: [] }]); return; }
    const projectsContext = projects.slice(0, 8).map(p => ({ id: p.id, name: p.name || 'Untitled', stage: p.stage || 'N/A', deadline: p.deadline || 'N/A', description: (p.description || '').slice(0, 600), members: (Array.isArray(p.team) ? p.team : []).map(uid => userMap[uid] || uid), tasks: (Array.isArray(p.tasks) ? p.tasks : []).slice(0, 6).flatMap(s => Array.isArray(s.tasks) ? s.tasks.slice(0, 6).map(t => ({ title: t.title || t.name || 'Task', status: t.status || 'open', deadline: t.deadline || '', stage: s.stage || '' })) : []) }));
    const forumsContext = forums.slice(0, 12).map(f => ({ id: f.id, name: f.name || 'Untitled', postsCount: f.posts || 0, recentPosts: (forumPostsDetailMap[f.id] || []).slice(0, 5).map(p => ({ title: p.title, excerpt: p.body, author: userMap[p.authorUid] || p.authorUid })) }));
    const customersContext = customers.slice(0, 10).map(c => ({ id: c.id, name: c.customerProfile?.name || c.customerProfile?.email || 'Customer', company: c.companyProfile?.company || '', currentStage: c.currentStage || '', notesCount: Object.keys(c.stageData || {}).reduce((acc, k) => acc + ((c.stageData?.[k]?.notes || []).length), 0), reminders: (c.reminders || []).length, files: (c.files || []).length }));
    const ctx = { user: currentUser?.email || currentUser?.uid || 'unknown', approvalsPending: insights.approvalsPending, upcomingDeadlines: insights.upcoming.slice(0, 10), projects: projectsContext, forums: forumsContext, customers: customersContext, tasksSample: insights.myTasks.slice(0, 20).map(t => ({ title: t.title || t.name || 'Task', project: t.projectName, status: t.status || 'open', stage: t.stage || '' })), attachments };
    try { setIsCalling(true); const answer = await callGemini(q, ctx); setSummary(cleanText(answer)); setHistory(h => [...h, { q, a: cleanText(answer), t: Date.now(), attachments }]); setQueryText(''); } catch (err) { const msg = `AI error: ${err.message}`; setSummary(msg); setHistory(h => [...h, { q, a: msg, t: Date.now(), attachments }]); } finally { setIsCalling(false); }
  };

  const handleSaveKey = () => { localStorage.setItem('gemini_api_key', apiKey); setShowKeyEditor(false); };
  const quickAsk = (q) => { setQueryText(q); setTimeout(() => handleAsk(), 0); };

  const safeLeft = Number.isFinite(pos?.x) ? pos.x : 0;
  const safeTop = Number.isFinite(pos?.y) ? pos.y : 0;
  const isAuthRoute = useMemo(() => {
    const p = (location?.pathname || '').toLowerCase();
    return p === '/login' || p === '/signup' || p === '/forgot-password' || p === '/verify-email';
  }, [location?.pathname]);
  const launcher = (
    <div style={{ position: 'fixed', left: safeLeft, top: safeTop, zIndex: 2147483647, fontFamily: fontStack }}>
      {!isOpen && (
        <div onMouseDown={startDrag} onClick={(e) => { if (dragMoved) { e.preventDefault(); return; } setIsOpen(true); }} title="Personal Assistant" style={{ lineHeight: 0, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))' }}>
          <CatAvatar size={76} fluffy={true} noBackground={true} />
        </div>
      )}
    </div>
  );

  const panel = isOpen && (
    <div style={{ position: 'fixed', left: safeLeft, top: safeTop, zIndex: 2147483647, width: 420, maxWidth: 'calc(100vw - 32px)', fontFamily: fontStack }}>
      <div style={{ background: '#ffffff', borderRadius: DESIGN_SYSTEM.borderRadius.xl, boxShadow: DESIGN_SYSTEM.shadows.lg, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '72vh', border: `1px solid ${DESIGN_SYSTEM.colors.border}` }}>
        <div onMouseDown={startDrag} style={{ padding: DESIGN_SYSTEM.spacing.base, background: headerGradient, backgroundSize: '400% 400%', animation: 'paGradientShift 14s ease infinite', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.15), 0 0 18px rgba(255,255,255,0.15)' }}>
          <div style={{ fontWeight: 700, fontSize: DESIGN_SYSTEM.typography.fontSize.base }}>Personal Assistant</div>
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.xs }}>
            <button onClick={() => setIsOpen(false)} style={{ ...blackBtn, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Close</button>
          </div>
        </div>
        <div style={{ padding: DESIGN_SYSTEM.spacing.base, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: DESIGN_SYSTEM.colors.background.elevated, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.base }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
            <div title="Total projects you own or joined" style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Projects: {insights.projectCount}</div>
            <div title="Forums you are a member of" style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Forums: {insights.forumCount}</div>
            <div title="Customer profiles you created" style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Customers: {insights.customerCount}</div>
            <div title="Active Projects = projects not in the Completed stage" style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Active Projects: {insights.activeProjects.length}</div>
            <div title="Approval requests still pending" style={{ padding: '4px 10px', borderRadius: 999, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Approvals: {insights.approvalsPending}</div>
          </div>
          {!showKeyEditor && (
            <button onClick={() => setShowKeyEditor(true)} style={{ ...blackBtnOutline, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Edit API Key</button>
          )}
        </div>
        {showKeyEditor && (
          <div style={{ padding: DESIGN_SYSTEM.spacing.base, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: DESIGN_SYSTEM.colors.background.card, display: 'flex', gap: DESIGN_SYSTEM.spacing.xs, alignItems: 'center' }}>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste GEMINI_API_KEY" style={{ flex: 1, padding: DESIGN_SYSTEM.spacing.base, borderRadius: DESIGN_SYSTEM.borderRadius.lg, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, outline: 'none' }} />
            <button onClick={handleSaveKey} style={{ ...blackBtn, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Save</button>
          </div>
        )}
        <div style={{ padding: DESIGN_SYSTEM.spacing.base, gap: DESIGN_SYSTEM.spacing.base, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.xs, alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Ask about projects, forums, customers, deadlines..." style={{ flex: 1, padding: DESIGN_SYSTEM.spacing.base, borderRadius: DESIGN_SYSTEM.borderRadius.lg, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, outline: 'none' }} />
            <label htmlFor="pa-chat-file-input" title="Attach file" style={{ padding: '6px 10px', border: `1px solid ${DESIGN_SYSTEM.colors.border}`, borderRadius: 8, cursor: 'pointer', background: '#fff' }}>📎</label>
            <input id="pa-chat-file-input" type="file" accept=".txt,.md,.json,.csv,.log,.html,.xml,.yml,.yaml,.pdf,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (!file) return;
              setStagedFile({ file, name: file.name, size: file.size });
              try { e.target.value = ''; } catch {}
            }} />
            <button type="button" disabled={isCalling} onClick={async () => {
              let attachments = [];
              if (stagedFile && currentUser?.uid) {
                try {
                  const path = `assistant_uploads/${currentUser.uid}/${Date.now()}_${stagedFile.name}`;
                  const sref = storageRef(storage, path);
                  await uploadBytes(sref, stagedFile.file);
                  const url = await getDownloadURL(sref);
                  let content = '';
                  try {
                    // Best-effort: read text content for common text types
                    if (/^(text\/|application\/(json|xml|yaml|x-yaml|x-yaml-stream))/.test(stagedFile.file.type) || /\.(txt|md|json|csv|log|xml|yml|yaml)$/i.test(stagedFile.name)) {
                      content = await stagedFile.file.text();
                    }
                  } catch {}
                  attachments = [{ name: stagedFile.name, size: stagedFile.size, url, content }];
                } catch (err) {
                  // Still proceed using local file content if readable
                  let content = '';
                  try { content = await stagedFile.file.text(); } catch {}
                  attachments = [{ name: stagedFile.name, size: stagedFile.size, url: '(upload failed)', content }];
                } finally {
                  setStagedFile(null);
                }
              }
              await handleAsk(attachments);
            }} style={{ ...blackBtn, padding: `${DESIGN_SYSTEM.spacing.base} ${DESIGN_SYSTEM.spacing.base}`, opacity: isCalling ? 0.7 : 1 }}>{isCalling ? 'Thinking…' : 'Ask'}</button>
          </div>
          {stagedFile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: `1px solid ${DESIGN_SYSTEM.colors.border}`, background: '#fff', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stagedFile.name} ({Math.round((stagedFile.size||0)/1024)} KB)</div>
              <button onClick={() => setStagedFile(null)} title="Remove" style={{ ...blackBtnOutline, padding: '4px 8px' }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
            <button onClick={() => quickAsk('List my upcoming deadlines in the next 14 days.')} style={{ ...blackBtnOutline, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Upcoming deadlines</button>
            <button onClick={() => quickAsk('Which projects have the most open tasks?')} style={{ ...blackBtnOutline, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Open tasks</button>
            <button onClick={() => quickAsk('Summarize recent forum activity.')} style={{ ...blackBtnOutline, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Forum summary</button>
            <button onClick={() => quickAsk('Show customer notes and reminders highlights.')} style={{ ...blackBtnOutline, padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.base}` }}>Customer highlights</button>
          </div>
          {summary && (
            <div style={{ padding: DESIGN_SYSTEM.spacing.base, background: DESIGN_SYSTEM.colors.background.muted, borderRadius: DESIGN_SYSTEM.borderRadius.lg, color: DESIGN_SYSTEM.colors.text.primary, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{summary}</div>
          )}
          {history.length > 0 && (
            <div style={{ borderTop: `1px solid ${DESIGN_SYSTEM.colors.border}`, paddingTop: DESIGN_SYSTEM.spacing.base }}>
              <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: DESIGN_SYSTEM.spacing.xs }}>Recent</div>
              <ul style={{ margin: 0, paddingLeft: DESIGN_SYSTEM.spacing.base, maxHeight: 160, overflowY: 'auto' }}>
                {history.slice(-10).reverse().map((h, idx) => (
                  <li key={idx} style={{ marginBottom: DESIGN_SYSTEM.spacing.xs, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>
                    <div style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Q: {h.q}</div>
                    <div style={{ color: DESIGN_SYSTEM.colors.text.primary }}>A: {h.a.slice(0, 200)}{h.a.length > 200 ? '…' : ''}</div>
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
      {currentUser && !isAuthRoute && createPortal(launcher, document.body)}
      {currentUser && !isAuthRoute && panel && createPortal(panel, document.body)}
    </>
  );
}
