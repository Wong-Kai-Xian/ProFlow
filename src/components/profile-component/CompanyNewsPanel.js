import React, { useEffect, useState } from 'react';
import { COLORS } from './constants';

export default function CompanyNewsPanel({ companyName }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNews = async () => {
      if (!companyName) return;
      const apiKey = localStorage.getItem('news_api_key');
      if (!apiKey) { setError('Missing news_api_key'); return; }
      try {
        setLoading(true); setError('');
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&language=en&sortBy=publishedAt&pageSize=3&apiKey=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        const json = await res.json();
        const arts = Array.isArray(json.articles) ? json.articles : [];
        setArticles(arts.slice(0,3));
      } catch (e) {
        setError(e.message || 'Failed to load news');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [companyName]);

  if (!companyName) return <div style={{ color: COLORS.lightText, fontSize: 12 }}>No company name.</div>;
  if (loading) return <div style={{ color: COLORS.lightText, fontSize: 12 }}>Loading news…</div>;
  if (error) return <div style={{ color: '#b91c1c', fontSize: 12 }}>{error}</div>;

  if (!articles.length) return <div style={{ color: COLORS.lightText, fontSize: 12 }}>No recent news found.</div>;

  const clamp = (s, n = 160) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
      {articles.map((a, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
          <a href={a.url} target="_blank" rel="noreferrer" style={{ color: '#1f2937', fontWeight: 600, textDecoration: 'none' }}>
            {a.title}
          </a>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12, color: COLORS.lightText }}>
            <span>{a.source?.name || 'Unknown source'}</span>
            <span>•</span>
            <span>{a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ''}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: COLORS.text }}>
            {clamp(a.description || a.content || '')}
          </div>
        </div>
      ))}
    </div>
  );
}


