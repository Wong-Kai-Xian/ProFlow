// src/components/profile-component/EmailAIDraftModal.js
import React, { useState } from "react";
import { BUTTON_STYLES, INPUT_STYLES, COLORS } from "./constants";

export default function EmailAIDraftModal({ isOpen, onClose, toEmail = "", toName = "", onOpenGmail }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  if (!isOpen) return null;

  const parseModelResponse = (text = "") => {
    try {
      const lines = String(text).split(/\r?\n/);
      let subj = "";
      let bodyLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!subj && /^\s*subject\s*:/i.test(line)) {
          subj = line.replace(/^\s*subject\s*:\s*/i, "").trim();
          bodyLines = lines.slice(i + 1);
          break;
        }
      }
      if (!subj) {
        // Fallback: first non-empty line as subject, rest as body
        const firstNonEmpty = lines.findIndex(l => l.trim());
        if (firstNonEmpty >= 0) {
          subj = lines[firstNonEmpty].trim();
          bodyLines = lines.slice(firstNonEmpty + 1);
        } else {
          subj = "";
          bodyLines = lines;
        }
      }
      return { subj, bodyText: bodyLines.join("\n").trim() };
    } catch {
      return { subj: "", bodyText: text };
    }
  };

  const generateDraft = async () => {
    try {
      setLoading(true); setError("");
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) { setError('Missing gemini_api_key in localStorage'); setLoading(false); return; }

      const recipient = toName || toEmail || 'the client';
      const instruction = (prompt || '').trim() || `a professional outreach email`;
      const sys = `You are an assistant that drafts concise, professional emails. Respond with a single draft in plain text. Put the subject on the first line starting with "Subject:" then a newline, then the email body. Avoid markdown.`;
      const user = `Draft ${instruction} to ${recipient}.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${sys}\n\n${user}` }] }
          ]
        })
      });

      if (!res.ok) { throw new Error(`API error: ${res.status}`); }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const { subj, bodyText } = parseModelResponse(text);
      setSubject(subj);
      setBody(bodyText);
    } catch (e) {
      setError(e?.message || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const openInGmail = () => {
    if (typeof onOpenGmail === 'function') {
      onOpenGmail({ to: toEmail, subject, body });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 720, maxWidth: '95%', padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>AI Email Draft</h3>
          <button onClick={onClose} style={{ ...BUTTON_STYLES.secondary }}>Close</button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>To</label>
          <input value={toEmail} readOnly style={{ ...INPUT_STYLES.base, width: '100%', background: '#f8fafc' }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>What do you want to say?</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., follow up on the proposal we sent last week and ask for feedback"
            rows={3}
            style={{ ...INPUT_STYLES.base, width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={generateDraft} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button onClick={openInGmail} disabled={!subject && !body} style={{ ...BUTTON_STYLES.secondary }}>
            Open in Gmail
          </button>
        </div>

        {error ? (
          <div style={{ color: COLORS.danger, marginBottom: 10 }}>{error}</div>
        ) : null}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            style={{ ...INPUT_STYLES.base, width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Email body"
            rows={10}
            style={{ ...INPUT_STYLES.base, width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
}


