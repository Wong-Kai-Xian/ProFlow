// src/components/profile-component/CompanyReputation.js
import React, { useState } from "react";
import Card from "./Card";
import { COLORS, INPUT_STYLES, BUTTON_STYLES } from "./constants";
import { DESIGN_SYSTEM } from "../../styles/designSystem";

export default function CompanyReputation({ data, companyProfile = {}, onAiUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const clampRating = (n) => Math.max(0, Math.min(5, Number.isFinite(Number(n)) ? Number(n) : 0));
  const safeParseJson = (str) => {
    try { return JSON.parse(str); } catch {}
    try { const m = str.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
    return null;
  };

  const runResearch = async () => {
    try {
      setLoading(true); setError("");
      const geminiKey = localStorage.getItem('gemini_api_key');
      const serpKey = localStorage.getItem('serp_api_key'); // optional
      const newsKey = localStorage.getItem('news_api_key'); // optional
      const name = companyProfile.company || companyProfile.companyName || '';
      const domain = companyProfile.website || '';
      const q = [name, domain].filter(Boolean).join(' ');
      let webSnippet = '';
      if (!geminiKey) { setError('Missing gemini_api_key in localStorage'); setLoading(false); return; }
      if (serpKey && q) {
        try {
          const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&hl=en&gl=us&api_key=${encodeURIComponent(serpKey)}`);
          const json = await res.json();
          const organic = Array.isArray(json.organic_results) ? json.organic_results.slice(0,5) : [];
          webSnippet = organic.map(o => `Title: ${o.title}\nSnippet: ${o.snippet || ''}\nLink: ${o.link || ''}`).join("\n---\n");
        } catch {}
      }
      // Include recent news
      if (newsKey && name) {
        try {
          const nres = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(name)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${encodeURIComponent(newsKey)}`);
          const njson = await nres.json();
          const arts = Array.isArray(njson.articles) ? njson.articles.slice(0,5) : [];
          const newsBlock = arts.map(a => `News: ${a.title}\nSource: ${a.source?.name || ''}\nPublished: ${a.publishedAt || ''}\nSummary: ${a.description || ''}\nLink: ${a.url || ''}`).join("\n---\n");
          webSnippet = [webSnippet, newsBlock].filter(Boolean).join("\n---\n");
        } catch {}
      }
      const prompt = `You are an analyst. Given a company name and optional website plus web search and news snippets, return JSON only with keys: rating (1-5 int), summary (<=120 words), strengths (array of strings), risks (array of strings). No extra commentary.\nCompany: ${name}\nWebsite: ${domain}\nSnippets:\n${webSnippet}`;
      const body = { contents: [{ role: 'user', parts: [{ text: prompt }]}], generationConfig: { temperature: 0.4, maxOutputTokens: 800 } };
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + encodeURIComponent(geminiKey || ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const dataResp = await resp.json();
      const text = dataResp?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = safeParseJson(text) || {};
      const normalized = {
        rating: clampRating(parsed.rating),
        summary: (parsed.summary && typeof parsed.summary === 'string') ? parsed.summary : (text && text.trim().startsWith('{') ? '' : text.slice(0, 600)),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 10) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 10) : []
      };
      if (typeof onAiUpdate === 'function') onAiUpdate(normalized);
    } catch (e) {
      setError(e.message || 'Failed to run AI research');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ background: DESIGN_SYSTEM.colors.background.primary }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: COLORS.dark }}>Company Reputation</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={runResearch} disabled={loading} style={{ ...BUTTON_STYLES.primary }}>
            {loading ? 'Researching…' : 'AI Research'}
          </button>
        </div>
      </div>
      {error && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      <div style={{ marginBottom: 6 }}>{"★".repeat(clampRating(data?.rating || 0)).padEnd(5, '☆')}</div>
      <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 6 }}>
        <div style={{ color: COLORS.text, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{data?.summary || 'No summary yet.'}</div>
        {Array.isArray(data?.strengths) && data.strengths.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Strengths</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {data.strengths.map((s, i) => (<li key={i}>{s}</li>))}
            </ul>
          </div>
        )}
        {Array.isArray(data?.risks) && data.risks.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Risks</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {data.risks.map((r, i) => (<li key={i}>{r}</li>))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
