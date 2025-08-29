import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { logLeadEventByEmail } from '../../services/leadScoreService';
import { ensureTokenFor, requestConsentFor, GMAIL_SCOPES_SEND } from '../../utils/googleAuth';

const BUTTON_STYLES = {
  primary: { background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 },
  secondary: { background: '#e5e7eb', color: '#374151', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 },
};

const INPUT_STYLES = {
  base: { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', fontSize: 14 }
};

const COLORS = {
  danger: '#dc2626'
};

// Tokens are obtained via centralized helpers; no auto-consent on module load

const decodeBase64Url = (base64Url) => {
  let base64 = (base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(',')[1];
    resolve(base64);
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const createMimeMessage = (to, subject, body, attachments = []) => [
  `From: me`,
  `To: ${to}`,
  `Subject: ${subject}`,
  `MIME-Version: 1.0`,
  ...(attachments.length === 0 ? [
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body
  ] : [
    `Content-Type: multipart/mixed; boundary="boundary123"`,
    ``,
    `--boundary123`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
    ...attachments.flatMap(a => [
      ``,
      `--boundary123`,
      `Content-Type: ${a.contentType}`,
      `Content-Disposition: attachment; filename="${a.name}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      a.base64 || ''
    ]),
    ``,
    `--boundary123--`
  ])
].join('\r\n');

const createReplyMessage = (to, subject, body, originalMessageId, attachments = []) => [
  `From: me`,
  `To: ${to}`,
  `Subject: ${subject}`,
  `In-Reply-To: ${originalMessageId}`,
  `References: ${originalMessageId}`,
  `MIME-Version: 1.0`,
  ...(attachments.length === 0 ? [
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body
  ] : [
    `Content-Type: multipart/mixed; boundary="boundary123"`,
    ``,
    `--boundary123`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
    ...attachments.flatMap(a => [
      ``,
      `--boundary123`,
      `Content-Type: ${a.contentType}`,
      `Content-Disposition: attachment; filename="${a.name}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      a.base64 || ''
    ]),
    ``,
    `--boundary123--`
  ])
].join('\r\n');

export default function GmailAIReplyModal({ isOpen, onClose, toEmail: toEmailProp, toName: toNameProp, customerEmail, customerName, onAddCustomerNotes, onAddCustomerTasks }) {
  const [mode, setMode] = useState('reply');
  const [token, setToken] = useState('');
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [confirmStep, setConfirmStep] = useState(0);
  const [confirmType, setConfirmType] = useState('');
  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [actions, setActions] = useState([]);
  const [pickActionsOpen, setPickActionsOpen] = useState(false);
  const [selectedActions, setSelectedActions] = useState({});

  // Backward compatibility: accept both toEmail/toName and customerEmail/customerName
  const toEmail = (toEmailProp || customerEmail || '').trim();
  const toName = toNameProp || customerName || '';

  const ensureToken = async () => {
    try {
      const t = await ensureTokenFor(GMAIL_SCOPES_SEND);
      return t || null;
    } catch { return null; }
  };

  const fetchThreads = async () => {
    try {
      setLoading(true); setError('');
      let at = token || await ensureToken();
      if (!at) { setAuthNeeded(true); setError('Authorization required.'); return; }
      if (!token) setToken(at);
      const query = encodeURIComponent(`from:${toEmail} OR to:${toEmail}`);
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=3`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${at}` } });
      if (!res.ok) throw new Error(`Gmail API error ${res.status}`);
      const json = await res.json();
      const messages = json.messages || [];
      const detailed = [];
      for (const msg of messages) {
        try {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, { headers: { Authorization: `Bearer ${at}` } });
          if (!detailRes.ok) continue;
          const detail = await detailRes.json();
          const headers = detail?.payload?.headers || [];
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
          const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
          const internalDate = detail.internalDate || '0';
          let text = '';
          const extractText = (part) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return decodeBase64Url(part.body.data);
            }
            if (part.parts) {
              for (const subPart of part.parts) {
                const subText = extractText(subPart);
                if (subText) return subText;
              }
            }
            return '';
          };
          text = extractText(detail.payload) || detail.snippet || '';
          const attachmentsMeta = [];
          const extractAttachments = (part) => {
            if (part.filename && part.body?.attachmentId) {
              attachmentsMeta.push({
                filename: part.filename,
                mimeType: part.mimeType,
                attachmentId: part.body.attachmentId
              });
            }
            if (part.parts) {
              part.parts.forEach(extractAttachments);
            }
          };
          extractAttachments(detail.payload);
          detailed.push({
            id: msg.id,
            threadId: detail.threadId,
            subject,
            from,
            date,
            text,
            snippet: detail.snippet || '',
            timestamp: parseInt(internalDate),
            attachmentsMeta
          });
        } catch {}
      }
      detailed.sort((a, b) => b.timestamp - a.timestamp);
      setThreads(detailed);
      if (detailed.length > 0 && !selected) setSelected(detailed[0]);
    } catch (e) {
      setError(e?.message || 'Failed to fetch emails');
      if (e.message?.includes('401') || e.message?.includes('403')) setAuthNeeded(true);
    } finally {
      setLoading(false);
    }
  };

  const generateReply = async () => {
    try {
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) throw new Error('Missing gemini_api_key in localStorage');
      if (!selected) throw new Error('No email selected');
      const context = `Original email:\nSubject: ${selected.subject}\nFrom: ${selected.from}\nDate: ${selected.date}\n\nBody:\n${selected.text}`;
      const userPrompt = prompt || 'Reply professionally and appropriately to this email.';
      const fullPrompt = `${context}\n\nUser wants to: ${userPrompt}\n\nWrite a professional email reply. Output JSON with keys: subject (string), body (string).`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [ { role: 'user', parts: [{ text: fullPrompt }] } ] })
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
      const origSubject = selected.subject || '';
      const replySubject = origSubject.toLowerCase().startsWith('re:') ? origSubject : `Re: ${origSubject}`;
      setSubject(parsed.subject || replySubject);
      setBody(parsed.body || '');
    } catch (e) {
      setError(e?.message || 'Failed to generate reply');
    } finally {
      setLoading(false);
    }
  };

  const generateNewEmail = async () => {
    try {
      setLoading(true); setError('');
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) throw new Error('Missing gemini_api_key in localStorage');
      const userPrompt = prompt || 'Write a professional email.';
      const fullPrompt = `Customer: ${toName || toEmail}\n\nUser wants to: ${userPrompt}\n\nWrite a professional email. Output JSON with keys: subject (string), body (string).`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [ { role: 'user', parts: [{ text: fullPrompt }] } ] })
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
      setSubject(parsed.subject || '');
      setBody(parsed.body || '');
    } catch (e) {
      setError(e?.message || 'Failed to generate email');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    try {
      setLoading(true); setError('');
      let at = token || await ensureToken();
      if (!at) { setAuthNeeded(true); setError('Authorization required.'); return; }
      if (!token) setToken(at);
      if (!selected) throw new Error('No email selected');
      const raw = createReplyMessage(toEmail, subject, body, selected.id, attachments);
      const encodedMessage = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: encodedMessage })
      });
      if (!res.ok) throw new Error(`Send failed ${res.status}`);
      
      // Log lead event after successful send
      if (toEmail) {
        await logLeadEventByEmail(toEmail, 'emailOutbound', { messageId: (await res.json())?.id });
        try { localStorage.setItem(`proflow_last_out_${toEmail.toLowerCase()}`, String(Date.now())); } catch {}
      }

      // Toast notification
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:16px;right:16px;background:#059669;color:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:2147483647;font-size:14px;font-weight:500;';
      toast.textContent = 'Reply sent successfully!';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
      setSubject(''); setBody(''); setAttachments([]);
      onClose && onClose();
    } catch (e) {
      setError(e?.message || 'Failed to send');
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
      const raw = createMimeMessage(toEmail, subject, body, attachments);
      const encodedMessage = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: encodedMessage })
      });
      if (!res.ok) throw new Error(`Send failed ${res.status}`);
      
      // Log lead event after successful send
      if (toEmail) {
        await logLeadEventByEmail(toEmail, 'emailOutbound', { messageId: (await res.json())?.id });
        try { localStorage.setItem(`proflow_last_out_${toEmail.toLowerCase()}`, String(Date.now())); } catch {}
      }

      // Toast notification
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:16px;right:16px;background:#059669;color:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:2147483647;font-size:14px;font-weight:500;';
      toast.textContent = 'Email sent successfully!';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
      setSubject(''); setBody(''); setAttachments([]);
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
            <button onClick={async () => { try { const t = await requestConsentFor(GMAIL_SCOPES_SEND); if (t) { setToken(t); setAuthNeeded(false); setError(''); try { await fetchThreads(); } catch {} } } catch {} }} style={{ ...BUTTON_STYLES.secondary }}>Authorize Gmail</button>
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

        {/* Toast container */}
        <div id="gmail-ai-toast-root" style={{ position: 'fixed', top: 16, right: 16, zIndex: 2147483647 }} />
      </div>
    </div>,
    document.body
  );
}