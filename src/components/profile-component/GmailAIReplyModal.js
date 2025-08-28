// src/components/profile-component/GmailAIReplyModal.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from 'react-dom';
import { BUTTON_STYLES, INPUT_STYLES, COLORS } from "./constants";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send"
].join(" ");

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function decodeBase64Url(str = "") {
  try {
    const replaced = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = replaced.length % 4 === 2 ? "==" : replaced.length % 4 === 3 ? "=" : "";
    const decoded = atob(replaced + pad);
    // Convert from binary string to UTF-8
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return text;
  } catch {
    try { return atob(str); } catch { return str; }
  }
}

function encodeBase64UrlUtf8(str = "") {
  const utf8Bytes = new TextEncoder().encode(str);
  let bin = "";
  utf8Bytes.forEach(b => { bin += String.fromCharCode(b); });
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result; // ArrayBuffer
        const bytes = new Uint8Array(result);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        resolve(b64);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function findHeader(headers = [], name = "") {
  const h = headers.find(h => (h?.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function extractPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  const queue = [payload];
  while (queue.length) {
    const part = queue.shift();
    if (!part) continue;
    if (part.parts) queue.push(...part.parts);
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  // Fallback to snippet-like text
  if (payload?.body?.data) return decodeBase64Url(payload.body.data);
  return '';
}

function collectAttachmentsFromPayload(payload, list = []) {
  if (!payload) return list;
  const stack = [payload];
  while (stack.length) {
    const p = stack.pop();
    if (!p) continue;
    if (Array.isArray(p.parts)) stack.push(...p.parts);
    const hasFilename = (p.filename || '').trim().length > 0;
    const attachmentId = p?.body?.attachmentId;
    if (hasFilename && attachmentId) {
      list.push({
        filename: p.filename,
        mimeType: p.mimeType || 'application/octet-stream',
        attachmentId,
        partId: p.partId || ''
      });
    }
  }
  return list;
}

export default function GmailAIReplyModal({ isOpen, onClose, toEmail = '', toName = '', onAddCustomerTasks, onAddCustomerNotes }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authError, setAuthError] = useState('');
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('reply'); // 'reply' | 'new' | 'analyze'
  const [attachments, setAttachments] = useState([]); // { name, contentType, base64 }
  const [confirmStep, setConfirmStep] = useState(0); // 0 none, 1 first, 2 second
  const [confirmType, setConfirmType] = useState(''); // 'reply' | 'new'
  const showToast = (message) => {
    try {
      const root = document.getElementById('gmail-ai-toast-root') || document.body;
      const id = `toast_${Date.now()}`;
      const el = document.createElement('div');
      el.id = id;
      el.style.position = 'fixed';
      el.style.top = '16px';
      el.style.right = '16px';
      el.style.zIndex = 2147483647;
      el.style.transition = 'all 0.3s ease';
      el.innerHTML = `
        <div style="background:#10b981;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px">✅</span>
          <span style="font-weight:600">${message}</span>
        </div>
      `;
      root.appendChild(el);
      setTimeout(() => {
        try { el.style.opacity = '0'; el.style.transform = 'translateY(-6px)'; } catch {}
      }, 1800);
      setTimeout(() => {
        try { root.removeChild(el); } catch {}
      }, 2300);
    } catch {}
  };

  const clientId = useMemo(() => localStorage.getItem('google_oauth_client_id') || '', []);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSubject('');
    setBody('');
    setSelected(null);
    // Do not trigger any auth UI when just opening modal
  }, [isOpen]);

  // Auto-load latest threads when modal opens for reply/analyze
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) { autoLoadedRef.current = false; return; }
    if ((mode === 'reply' || mode === 'analyze') && !autoLoadedRef.current) {
      (async () => {
        try { await fetchThreads(); autoLoadedRef.current = true; } catch {}
      })();
    }
  }, [isOpen, mode]);

  const ensureToken = async () => {
    try {
      if (!clientId) { throw new Error('Missing google_oauth_client_id in localStorage'); }
      await loadScriptOnce('https://accounts.google.com/gsi/client');
      return await new Promise((resolve) => {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPES,
            prompt: 'none',
            callback: (resp) => {
              if (resp?.access_token) { resolve(resp.access_token); }
              else { resolve(null); }
            },
          });
          tokenClient.requestAccessToken({ prompt: 'none' });
        } catch { resolve(null); }
      });
    } catch (e) {
      throw e;
    }
  };

  const requestInteractiveToken = async () => {
    try {
      if (!clientId) { setAuthError('Missing google_oauth_client_id'); return null; }
      await loadScriptOnce('https://accounts.google.com/gsi/client');
      return await new Promise((resolve) => {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPES,
            prompt: 'consent',
            callback: (resp) => {
              if (resp?.access_token) { setAuthError(''); resolve(resp.access_token); }
              else { setAuthError(resp?.error || 'Authorization failed'); resolve(null); }
            },
          });
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch { resolve(null); }
      });
    } catch { return null; }
  };

  const fetchThreads = async () => {
    try {
      setLoading(true); setError('');
      let at = token || await ensureToken();
      if (!at) {
        setAuthNeeded(true);
        setError('Authorization required. Click Authorize Gmail.');
        return;
      }
      if (!token) setToken(at);
      const q = `from:${toEmail} OR to:${toEmail}`;
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=3`, {
        headers: { Authorization: `Bearer ${at}` }
      });
      if (res.status === 401 || res.status === 403) {
        setAuthNeeded(true);
        setError('Authorization required. Click Authorize Gmail.');
        return;
      }
      if (!res.ok) throw new Error(`List error ${res.status}`);
      const json = await res.json();
      const messages = Array.isArray(json.messages) ? json.messages : [];
      const detailed = [];
      for (const m of messages) {
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
          headers: { Authorization: `Bearer ${at}` }
        });
        if (!r.ok) continue;
        const mj = await r.json();
        const headers = mj?.payload?.headers || [];
        const subj = findHeader(headers, 'Subject');
        const from = findHeader(headers, 'From');
        const date = findHeader(headers, 'Date');
        const msgId = findHeader(headers, 'Message-Id');
        const text = extractPlainText(mj?.payload);
        const attachmentsMeta = collectAttachmentsFromPayload(mj?.payload, []);
        detailed.push({ id: mj.id, threadId: mj.threadId, subject: subj, from, date, messageIdHeader: msgId, snippet: mj.snippet || '', text, attachmentsMeta });
      }
      setThreads(detailed);
    } catch (e) {
      setError(e?.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const generateReply = async () => {
    try {
      if (!selected) return;
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) { throw new Error('Missing gemini_api_key in localStorage'); }
      const instruction = (prompt || '').trim() || 'a concise, professional reply';
      const sys = `You draft professional, concise email replies. Output plain text only. Start with a single line 'Subject: ...' then a blank line and the body.`;
      const context = `Original Subject: ${selected.subject}\nFrom: ${selected.from}\nDate: ${selected.date}\n\nMessage:\n${selected.text}`;
      const user = `Write ${instruction} to ${toName || toEmail}.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          contents: [ { role: 'user', parts: [{ text: `${sys}\n\n${context}\n\n${user}` }] } ]
        })
      });
      if (!res.ok) throw new Error(`AI error ${res.status}`);
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // parse subject and body
      const lines = text.split(/\r?\n/);
      let subj = '';
      let bodyLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!subj && /^\s*subject\s*:/i.test(line)) {
          subj = line.replace(/^\s*subject\s*:\s*/i, '').trim();
          bodyLines = lines.slice(i + 1);
          break;
        }
      }
      if (!subj) {
        subj = selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`.trim();
        bodyLines = lines;
      }
      setSubject(subj);
      setBody(bodyLines.join('\n').trim());
    } catch (e) {
      setError(e?.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    try {
      if (!selected) return;
      setLoading(true); setError('');
      let at = token || await ensureToken();
      if (!at) { setAuthNeeded(true); setError('Authorization required.'); return; }
      if (!token) setToken(at);
      const replySubject = subject || (selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`.trim());
      const origMsgId = selected.messageIdHeader || '';
      const boundary = `mime_boundary_${Date.now()}`;
      let mimeParts = [];
      mimeParts.push([
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        '',
        body || ''
      ].join('\r\n'));
      for (const a of attachments) {
        mimeParts.push([
          `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${a.name}"`,
          `Content-Disposition: attachment; filename="${a.name}"`,
          `Content-Transfer-Encoding: base64`,
          '',
          a.base64 || ''
        ].join('\r\n'));
      }
      const mixedBody = mimeParts.map(p => `--${boundary}\r\n${p}`).join('\r\n') + `\r\n--${boundary}--`;
      const mime = [
        `To: ${toEmail}`,
        `Subject: ${replySubject}`,
        origMsgId ? `In-Reply-To: ${origMsgId}` : '',
        origMsgId ? `References: ${origMsgId}` : '',
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        mixedBody
      ].filter(Boolean).join('\r\n');
      const raw = encodeBase64UrlUtf8(mime);
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
        body: JSON.stringify({ raw, threadId: selected.threadId })
      });
      if (!sendRes.ok) throw new Error(`Send error ${sendRes.status}`);
      showToast('Reply sent successfully');
      onClose && onClose();
    } catch (e) {
      setError(e?.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  const generateNewEmail = async () => {
    try {
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) { throw new Error('Missing gemini_api_key in localStorage'); }
      const instruction = (prompt || '').trim() || 'a concise, professional outreach email';
      const sys = `You draft professional, concise emails. Output plain text only. Start with 'Subject: ...' then a blank line and the body.`;
      const user = `Write ${instruction} to ${toName || toEmail}.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          contents: [ { role: 'user', parts: [{ text: `${sys}\n\n${user}` }] } ]
        })
      });
      if (!res.ok) throw new Error(`AI error ${res.status}`);
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const lines = text.split(/\r?\n/);
      let subj = '';
      let bodyLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!subj && /^\s*subject\s*:/i.test(line)) {
          subj = line.replace(/^\s*subject\s*:\s*/i, '').trim();
          bodyLines = lines.slice(i + 1);
          break;
        }
      }
      if (!subj) { subj = ''; bodyLines = lines; }
      setSubject(subj);
      setBody(bodyLines.join('\n').trim());
    } catch (e) {
      setError(e?.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const sendNew = async () => {
    try {
      setLoading(true); setError('');
      let at = token || await ensureToken();
      if (!at) { setAuthNeeded(true); setError('Authorization required.'); return; }
      if (!token) setToken(at);
      const newSubject = subject || '(no subject)';
      const boundary = `mime_boundary_${Date.now()}`;
      let mimeParts = [];
      mimeParts.push([
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 7bit`,
        '',
        body || ''
      ].join('\r\n'));
      for (const a of attachments) {
        mimeParts.push([
          `Content-Type: ${a.contentType || 'application/octet-stream'}; name="${a.name}"`,
          `Content-Disposition: attachment; filename="${a.name}"`,
          `Content-Transfer-Encoding: base64`,
          '',
          a.base64 || ''
        ].join('\r\n'));
      }
      const mixedBody = mimeParts.map(p => `--${boundary}\r\n${p}`).join('\r\n') + `\r\n--${boundary}--`;
      const mime = [
        `To: ${toEmail}`,
        `Subject: ${newSubject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        mixedBody
      ].join('\r\n');
      const raw = encodeBase64UrlUtf8(mime);
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
        body: JSON.stringify({ raw })
      });
      if (!sendRes.ok) throw new Error(`Send error ${sendRes.status}`);
      showToast('Email sent successfully');
      onClose && onClose();
    } catch (e) {
      setError(e?.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  const downloadAttachment = async (meta, messageId) => {
    try {
      let at = token || await ensureToken();
      if (!at) { setAuthNeeded(true); setError('Authorization required.'); return; }
      if (!token) setToken(at);
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(meta.attachmentId)}`, {
        headers: { Authorization: `Bearer ${at}` }
      });
      if (!res.ok) throw new Error(`Attachment error ${res.status}`);
      const json = await res.json();
      const base64Url = json?.data || '';
      const bin = decodeBase64Url(base64Url);
      const bytes = new Uint8Array(bin.split('').map(c => c.charCodeAt(0)));
      const blob = new Blob([bytes], { type: meta.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.filename || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message || 'Failed to download attachment');
    }
  };

  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [actions, setActions] = useState([]);
  const [pickActionsOpen, setPickActionsOpen] = useState(false);
  const [selectedActions, setSelectedActions] = useState({});

  const analyze = async () => {
    try {
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) throw new Error('Missing gemini_api_key in localStorage');
      if (threads.length === 0) await fetchThreads();
      if (!selected) throw new Error('Please select an email to analyze.');
      const m = selected;
      const context = `Subject: ${m.subject}\nFrom: ${m.from}\nDate: ${m.date}\n\nBody:\n${m.text}`;
      const sys = `Summarize the emails, infer sentiment (positive/neutral/negative with brief reason), and extract 3-7 actionable next steps as bullet points. Output JSON with keys: summary (string), sentiment (string), actions (string[]).`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [ { role: 'user', parts: [{ text: `${sys}\n\n${context}` }] } ] })
      });
      if (!res.ok) throw new Error(`AI error ${res.status}`);
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
      }
      if (!parsed) throw new Error('Failed to parse AI response');
      setSummary(parsed.summary || '');
      setSentiment(parsed.sentiment || '');
      setActions(Array.isArray(parsed.actions) ? parsed.actions : []);
    } catch (e) {
      setError(e?.message || 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 1200, maxWidth: '98%', padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flex: '0 0 auto' }}>
          <h3 style={{ margin: 0 }}>Email</h3>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Close</button>
        </div>

        <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>Note: Set OAuth Client ID at top bar Settings or in console: localStorage.setItem('google_oauth_client_id','YOUR_CLIENT_ID')</div>
        {authNeeded && (
          <div style={{ marginBottom: 10, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff8e1', color: '#7c6f00', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>{authError ? `Error: ${authError}` : 'Authorize Gmail to read and send emails.'}</div>
            <button onClick={async () => { const t = await requestInteractiveToken(); if (t) { setToken(t); setAuthNeeded(false); setError(''); try { await fetchThreads(); } catch {} } }} style={{ ...BUTTON_STYLES.secondary }}>Authorize Gmail</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flex: '0 0 auto', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
          <button onClick={() => setMode('reply')} style={{
            background: 'transparent',
            color: '#111827',
            border: 'none',
            padding: '6px 0',
            fontWeight: mode==='reply' ? 700 : 500,
            borderBottom: mode==='reply' ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer'
          }}>Read & Reply</button>
          <button onClick={() => setMode('new')} style={{
            background: 'transparent',
            color: '#111827',
            border: 'none',
            padding: '6px 0',
            fontWeight: mode==='new' ? 700 : 500,
            borderBottom: mode==='new' ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer'
          }}>New Email</button>
          <button onClick={() => setMode('analyze')} style={{
            background: 'transparent',
            color: '#111827',
            border: 'none',
            padding: '6px 0',
            fontWeight: mode==='analyze' ? 700 : 500,
            borderBottom: mode==='analyze' ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer'
          }}>Analyze</button>
        </div>

        {error ? <div style={{ color: COLORS.danger, marginBottom: 8, flex: '0 0 auto' }}>{error}</div> : null}

        {mode === 'reply' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: '1 1 auto', minHeight: 0 }}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Contact</label>
                <input value={`${toName || ''} <${toEmail}>`} readOnly style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={fetchThreads} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>{loading ? 'Loading…' : 'Load Latest (3)'}</button>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 0, maxHeight: '50vh', overflow: 'auto' }}>
                {threads.length === 0 ? (
                  <div style={{ color: '#6b7280', padding: 8 }}>No messages loaded yet.</div>
                ) : (
                  threads.map((t, idx) => (
                    <div key={t.id} onClick={() => setSelected(t)} style={{ padding: 10, borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: selected?.id === t.id ? '#eef2ff' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || '(no subject)'}</div>
                        <div style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>#{idx + 1}</div>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.from} • {t.date}</div>
                      <div style={{ color: '#374151', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{(t.text || t.snippet || '').slice(0, 400)}</div>
                    </div>
                  ))
                )}
              </div>
              {selected?.attachmentsMeta?.length ? (
                <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#f9fafb' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Attachments</div>
                  {selected.attachmentsMeta.map((a, i) => (
                    <div key={`${a.attachmentId}_${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: i===0 ? 'none' : '1px solid #e5e7eb' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }} title={a.filename}>{a.filename}</div>
                      <button onClick={() => downloadAttachment(a, selected.id)} style={{ ...BUTTON_STYLES.secondary }}>Download</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>What do you want to say?</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="e.g., thank them, answer questions 1 and 2, propose a call next week" style={{ ...INPUT_STYLES.base, width: '100%', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={generateReply} disabled={loading || !selected} style={{ ...BUTTON_STYLES.primary }}>{loading ? 'Generating…' : 'AI Draft Reply'}</button>
                <button onClick={() => { if (!loading && selected && (subject || body)) { setConfirmType('reply'); setConfirmStep(1); } }} disabled={loading || !selected || (!subject && !body)} style={{ ...BUTTON_STYLES.secondary }}>Send Reply</button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Attachments</label>
                <input type="file" multiple onChange={async (e) => {
                  try {
                    const files = Array.from(e.target.files || []);
                    const mapped = [];
                    for (const f of files) {
                      const base64 = await fileToBase64(f);
                      mapped.push({ name: f.name, contentType: f.type || 'application/octet-stream', base64 });
                    }
                    setAttachments(mapped);
                  } catch {}
                }} />
                {attachments.length > 0 ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>{attachments.length} file(s) attached</div>
                ) : null}
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} style={{ ...INPUT_STYLES.base, width: '100%' }} />
              </div>
              <div style={{ minHeight: '30vh' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Body</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#f9fafb', margin: '0 6px' }}>
                  <textarea value={body} onChange={e => setBody(e.target.value)}
                    style={{ width: '100%', minHeight: '28vh', resize: 'vertical', whiteSpace: 'pre-wrap', border: 'none', outline: 'none', background: 'transparent' }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {mode === 'new' ? (
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>To</label>
              <input value={`${toName || ''} <${toEmail}>`} readOnly style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>What do you want to say?</label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="e.g., follow up on proposal; propose call next week" style={{ ...INPUT_STYLES.base, width: '100%', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={generateNewEmail} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>{loading ? 'Generating…' : 'AI Draft New'}</button>
              <button onClick={() => { if (!loading && (subject || body)) { setConfirmType('new'); setConfirmStep(1); } }} disabled={loading || (!subject && !body)} style={{ ...BUTTON_STYLES.secondary }}>Send</button>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Attachments</label>
              <input type="file" multiple onChange={async (e) => {
                try {
                  const files = Array.from(e.target.files || []);
                  const mapped = [];
                  for (const f of files) {
                    const base64 = await fileToBase64(f);
                    mapped.push({ name: f.name, contentType: f.type || 'application/octet-stream', base64 });
                  }
                  setAttachments(mapped);
                } catch {}
              }} />
              {attachments.length > 0 ? (
                <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>{attachments.length} file(s) attached</div>
              ) : null}
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} style={{ ...INPUT_STYLES.base, width: '100%' }} />
            </div>
            <div style={{ minHeight: '40vh' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Body</label>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#f9fafb', margin: '0 6px' }}>
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  style={{ width: '100%', minHeight: '38vh', resize: 'vertical', whiteSpace: 'pre-wrap', border: 'none', outline: 'none', background: 'transparent' }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {mode === 'analyze' ? (
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 8, height: '100%', minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={fetchThreads} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>{loading ? 'Loading…' : 'Load Latest (3)'}</button>
              <button onClick={analyze} disabled={loading || !selected} style={{ ...BUTTON_STYLES.secondary }}>Analyze</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 }}>
              <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 0, flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
                {threads.length === 0 ? <div style={{ color: '#6b7280', padding: 8 }}>No messages loaded.</div> : (
                  threads.map(m => (
                    <div key={m.id} onClick={() => setSelected(m)} style={{ padding: 10, borderBottom: '1px solid #e5e7eb', cursor: 'pointer', background: selected?.id === m.id ? '#eef2ff' : 'transparent' }}>
                      <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject || '(no subject)'}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{m.from} • {m.date}</div>
                      <div style={{ color: '#374151', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{(m.text || '').slice(0, 700)}</div>
                    </div>
                  ))
                )}
                </div>
                {selected?.attachmentsMeta?.length ? (
                  <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#f9fafb', maxHeight: '30vh', overflow: 'auto', flex: '0 0 auto' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Attachments</div>
                    {selected.attachmentsMeta.map((a, i) => (
                      <div key={`${a.attachmentId}_${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: i===0 ? 'none' : '1px solid #e5e7eb' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }} title={a.filename}>{a.filename}</div>
                        <button onClick={() => downloadAttachment(a, selected.id)} style={{ ...BUTTON_STYLES.secondary }}>Download</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Summary</label>
                  <textarea value={summary} readOnly rows={6} style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Sentiment</label>
                  <input value={sentiment} readOnly style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
                </div>
                <div style={{ overflow: 'auto' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Action Items</label>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {actions.length === 0 ? <li style={{ color: '#6b7280' }}>None</li> : actions.map((a, idx) => <li key={idx}>{a}</li>)}
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => setPickActionsOpen(true)} style={{ ...BUTTON_STYLES.secondary }}>Use Selected Actions…</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        

        {confirmStep > 0 ? (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }}>
            <div style={{ background: '#ffffff', width: 520, maxWidth: '92%', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.25)', padding: 20 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>{confirmStep === 1 ? 'Confirm send' : 'Please confirm again'}</h3>
              <p style={{ marginTop: 0, color: '#4b5563' }}>
                {confirmType === 'reply' ? 'You are about to send a reply.' : 'You are about to send a new email.'}
              </p>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb', marginBottom: 12 }}>
                <div style={{ marginBottom: 6 }}><strong>To:</strong> {toName ? `${toName} <${toEmail}>` : toEmail}</div>
                <div style={{ marginBottom: 6 }}><strong>Subject:</strong> {subject || '(no subject)'}</div>
                <div style={{ marginBottom: 6 }}><strong>Attachments:</strong> {attachments.length}</div>
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, background: '#fff' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{(body || '').slice(0, 2000)}</pre>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setConfirmStep(0)} style={{ ...BUTTON_STYLES.secondary }}>Cancel</button>
                {confirmStep === 1 ? (
                  <button onClick={() => setConfirmStep(2)} style={{ ...BUTTON_STYLES.primary }}>Confirm</button>
                ) : (
                  <button onClick={async () => {
                    setConfirmStep(0);
                    if (confirmType === 'reply') { await sendReply(); }
                    else { await sendNew(); }
                  }} style={{ ...BUTTON_STYLES.primary }}>Send</button>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {/* Toast container */}
        <div id="gmail-ai-toast-root" style={{ position: 'fixed', top: 16, right: 16, zIndex: 2147483647 }} />
      </div>
      {pickActionsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 560, maxWidth: '95vw', padding: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>Select Action Items</div>
              <button onClick={() => setPickActionsOpen(false)} style={{ ...BUTTON_STYLES.secondary }}>Close</button>
            </div>
            <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
              {actions.length === 0 ? (
                <div style={{ color: '#6b7280' }}>No actions available.</div>
              ) : actions.map((a, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
                  <input type="checkbox" checked={!!selectedActions[idx]} onChange={(e) => setSelectedActions(prev => ({ ...prev, [idx]: e.target.checked }))} />
                  <span>{a}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
              <button onClick={() => setSelectedActions({})} style={{ ...BUTTON_STYLES.secondary }}>Clear</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => {
                  try {
                    const picked = actions.filter((_, i) => selectedActions[i]);
                    if (picked.length === 0) { setPickActionsOpen(false); return; }
                    setBody(prev => {
                      const more = `\n\nNotes from analysis:\n- ${picked.join('\n- ')}`;
                      return (prev || '') + more;
                    });
                    try { if (typeof onAddCustomerNotes === 'function') onAddCustomerNotes(picked); } catch {}
                    setPickActionsOpen(false);
                  } catch {}
                }} style={{ ...BUTTON_STYLES.secondary }}>Add to Notes</button>
                <button onClick={async () => {
                  try {
                    const picked = actions.filter((_, i) => selectedActions[i]);
                    if (picked.length === 0) { setPickActionsOpen(false); return; }
                    setBody(prev => {
                      const more = `\n\nAction checklist:\n${picked.map(t => `[] ${t}`).join('\n')}`;
                      return (prev || '') + more;
                    });
                    try { if (typeof onAddCustomerTasks === 'function') onAddCustomerTasks(picked); } catch {}
                    setPickActionsOpen(false);
                  } catch {}
                }} style={{ ...BUTTON_STYLES.primary }}>Add as Tasks</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}


