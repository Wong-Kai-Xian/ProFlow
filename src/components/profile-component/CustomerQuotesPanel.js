import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';

export default function CustomerQuotesPanel({ customerId, projects = [], customerProfile = {}, readOnly = false }) {
  const [quotes, setQuotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client: '', validUntil: '', items: [] });
  

  useEffect(() => {
    if (!customerId) { setQuotes([]); return; }
    const col = collection(db, 'customerProfiles', customerId, 'quotesDrafts');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(q => !q.projectId) // show only customer-level quotes, not ones linked to a project
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setQuotes(list);
    });
    return () => unsub();
  }, [customerId]);

  const subtotal = useMemo(() => (form.items || []).reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0), [form.items]);

  const openNew = () => {
    setForm({ client: customerProfile?.name || customerProfile?.email || '', validUntil: '', items: [{ description: '', qty: 1, unitPrice: 0 }] });
    setShowModal(true);
  };

  const saveQuote = async () => {
    try {
      if (!customerId) return;
      const col = collection(db, 'customerProfiles', customerId, 'quotesDrafts');
      const items = (form.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
      const total = items.reduce((a,it)=> a + (it.qty*it.unitPrice), 0);
      await addDoc(col, { client: form.client || '', validUntil: form.validUntil || '', items, total, status: 'draft', createdAt: serverTimestamp() });
      setShowModal(false);
    } catch {}
  };

  const removeDraft = async (q) => {
    try { await deleteDoc(doc(db, 'customerProfiles', customerId, 'quotesDrafts', q.id)); } catch {}
  };

  

  const printDraft = (q) => {
    try {
      const items = Array.isArray(q.items) ? q.items : [];
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Quote - ${q.client || ''}</title><style>
        body{font-family:Arial,sans-serif;color:#111827;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .brand{font-weight:700;font-size:20px}
        .muted{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        .total{font-weight:700}
      </style></head><body>
        <div class="head">
          <div>
            <div class="brand">ProFlow</div>
            <div class="muted">Quote (Draft)</div>
          </div>
          <div class="muted">
            <div>Customer: ${q.client || ''}</div>
            <div>Valid Until: ${q.validUntil || '-'}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Description</th><th style="width:120px">Qty</th><th style="width:140px">Unit Price</th><th style="width:140px">Amount</th></tr></thead>
          <tbody>
            ${items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td>${Number(it.qty||0)}</td><td>${Number(it.unitPrice||0).toFixed(2)}</td><td>${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')}
            <tr><td class="total" colspan="3">Total</td><td class="total">${Number(q.total||subtotal||0).toFixed(2)}</td></tr>
          </tbody>
        </table>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch {}
  };

  return (
    <div style={getCardStyle('customers')}>
      <div style={{
        background: DESIGN_SYSTEM.pageThemes.customers.gradient,
        color: DESIGN_SYSTEM.colors.text.inverse,
        padding: DESIGN_SYSTEM.spacing.base,
        borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Customer Quotes (Drafts)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!readOnly && (
            <button onClick={openNew} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Quote</button>
          )}
        </div>
      </div>
      <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 200px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
          <div>Client</div>
          <div>Valid Until</div>
          <div>Total</div>
          <div>Actions</div>
        </div>
        <div style={{ marginTop: 6 }}>
          {quotes.length === 0 ? (
            <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No draft quotes</div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 200px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.client || 'Client'}</div>
                <div>{q.validUntil || '-'}</div>
                <div>{Number(q.total||0).toFixed(2)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => printDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Print</button>
                  {!readOnly && (
                    <button onClick={() => removeDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && !readOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={() => setShowModal(false)}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>New Quote</div>
              <button onClick={() => setShowModal(false)} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280', flex: 1 }}>
                <span style={{ marginBottom: 4 }}>Client</span>
                <input value={form.client} onChange={(e)=> setForm(f=>({ ...f, client: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280', width: 200 }}>
                <span style={{ marginBottom: 4 }}>Valid Until</span>
                <input type="date" value={form.validUntil} onChange={(e)=> setForm(f=>({ ...f, validUntil: e.target.value }))} />
              </label>
            </div>
            <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
              <div>Description</div>
              <div>Qty</div>
              <div>Unit Price</div>
              <div></div>
            </div>
            <div style={{ marginTop: 6 }}>
              {(form.items || []).map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
                  <input value={it.description || ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], description: e.target.value }; return { ...f, items }; })} />
                  <input type="number" step="1" value={it.qty ?? ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], qty: e.target.value }; return { ...f, items }; })} />
                  <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e)=> setForm(f=>{ const items=[...(f.items||[])]; items[idx]={ ...items[idx], unitPrice: e.target.value }; return { ...f, items }; })} />
                  <button onClick={()=> setForm(f=>{ const items=[...(f.items||[])]; items.splice(idx,1); return { ...f, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <button onClick={()=> setForm(f=>({ ...f, items: [...(f.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
              <div>Subtotal: {subtotal.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={saveQuote} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


