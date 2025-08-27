// src/components/profile-component/GmailAnalyzeModal.js
import React, { useEffect, useMemo, useState } from "react";
import { BUTTON_STYLES, INPUT_STYLES, COLORS } from "./constants";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly"
].join(" ");

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error(`Failed to load ${src}`)); document.head.appendChild(s);
  });
}

function decodeBase64Url(str = "") {
  try {
    const replaced = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = replaced.length % 4 === 2 ? "==" : replaced.length % 4 === 3 ? "=" : "";
    const decoded = atob(replaced + pad);
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { try { return atob(str); } catch { return str; } }
}

function findHeader(headers = [], name = "") { const h = headers.find(h => (h?.name || '').toLowerCase() === name.toLowerCase()); return h?.value || ''; }

function extractPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBase64Url(payload.body.data);
  const queue = [payload];
  while (queue.length) {
    const part = queue.shift();
    if (!part) continue;
    if (part.parts) queue.push(...part.parts);
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Url(part.body.data);
  }
  if (payload?.body?.data) return decodeBase64Url(payload.body.data);
  return '';
}

export default function GmailAnalyzeModal({ isOpen, onClose, toEmail = '', toName = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState('');
  const [actions, setActions] = useState([]);
  const [sentiment, setSentiment] = useState('');

  const clientId = useMemo(() => localStorage.getItem('google_oauth_client_id') || '', []);

  useEffect(() => { if (!isOpen) { setMessages([]); setSummary(''); setActions([]); setSentiment(''); setError(''); } }, [isOpen]);

  const ensureToken = async () => {
    try {
      if (!clientId) return null;
      await loadScriptOnce('https://accounts.google.com/gsi/client');
      return await new Promise((resolve) => {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GMAIL_SCOPES,
            prompt: 'none',
            callback: (resp) => resolve(resp?.access_token || null)
          });
          tokenClient.requestAccessToken({ prompt: 'none' });
        } catch { resolve(null); }
      });
    } catch { return null; }
  };

  const fetchLatest = async () => {
    try {
      setLoading(true); setError('');
      const at = token || await ensureToken();
      if (!at) { setLoading(false); return; }
      if (!token) setToken(at);
      const q = `from:${toEmail} OR to:${toEmail}`;
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=3`, { headers: { Authorization: `Bearer ${at}` } });
      if (!res.ok) throw new Error(`List error ${res.status}`);
      const json = await res.json();
      const items = Array.isArray(json.messages) ? json.messages : [];
      const detailed = [];
      for (const m of items) {
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, { headers: { Authorization: `Bearer ${at}` } });
        if (!r.ok) continue;
        const mj = await r.json();
        const headers = mj?.payload?.headers || [];
        const subj = findHeader(headers, 'Subject');
        const from = findHeader(headers, 'From');
        const date = findHeader(headers, 'Date');
        const text = extractPlainText(mj?.payload);
        detailed.push({ id: mj.id, subject: subj, from, date, text });
      }
      setMessages(detailed);
    } catch (e) {
      setError(e?.message || 'Failed to fetch');
    } finally { setLoading(false); }
  };

  const analyze = async () => {
    try {
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) throw new Error('Missing gemini_api_key in localStorage');
      const context = messages.map((m,i) => `Email ${i+1}\nSubject: ${m.subject}\nFrom: ${m.from}\nDate: ${m.date}\nBody:\n${m.text}`).join("\n\n---\n\n");
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
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 960, maxWidth: '96%', padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Analyze Recent Emails</h3>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={fetchLatest} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>{loading ? 'Loading…' : 'Load Latest (3)'}</button>
          <button onClick={analyze} disabled={loading || messages.length === 0} style={{ ...BUTTON_STYLES.secondary }}>Analyze</button>
        </div>
        {error ? <div style={{ color: COLORS.danger, marginBottom: 8 }}>{error}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, maxHeight: 420, overflow: 'auto' }}>
            {messages.length === 0 ? <div style={{ color: '#6b7280' }}>No messages loaded.</div> : (
              messages.map(m => (
                <div key={m.id} style={{ padding: 8, borderRadius: 6 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.subject || '(no subject)'}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{m.from} • {m.date}</div>
                  <div style={{ color: '#374151', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{(m.text || '').slice(0, 700)}</div>
                </div>
              ))
            )}
          </div>

          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Summary</label>
              <textarea value={summary} readOnly rows={6} style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Sentiment</label>
              <input value={sentiment} readOnly style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Action Items</label>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {actions.length === 0 ? <li style={{ color: '#6b7280' }}>None</li> : actions.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>
          Note: Set OAuth Client ID and Gemini key if not already set.
        </div>
      </div>
    </div>
  );
}


