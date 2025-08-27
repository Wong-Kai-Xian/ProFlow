import { renderQuotePdf } from '../../utils/quotePdf';
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { DESIGN_SYSTEM, getCardStyle } from '../../styles/designSystem';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomerQuotesPanel({ customerId, projects = [], customerProfile = {}, readOnly = false }) {
  const { currentUser } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ client: '', validUntil: '', taxRate: 0, discount: 0, items: [], currency: '', fxBase: 'USD', fxRate: 1 });
  const [globalFxBase, setGlobalFxBase] = useState('USD');
  

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

  useEffect(() => {
    const loadBase = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults');
        const snap = await (await import('firebase/firestore')).getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() || {};
          const b = (d.fxRates?.base || d.currency || 'USD');
          setGlobalFxBase((b || 'USD').toUpperCase());
        }
      } catch {}
    };
    loadBase();
  }, [currentUser?.uid]);

  const subtotal = useMemo(() => (form.items || []).reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0), [form.items]);

  const openNew = () => {
    const defaultTax = (customerProfile?.financeDefaults?.taxRate ?? customerProfile?.taxRate ?? 0);
    setForm({ client: customerProfile?.name || customerProfile?.email || '', validUntil: '', taxRate: defaultTax, discount: 0, items: [{ description: '', qty: 1, unitPrice: 0 }], currency: (customerProfile?.financeDefaults?.currency || customerProfile?.currency || ''), fxBase: (customerProfile?.financeDefaults?.currency || 'USD'), fxRate: 1 });
    setShowModal(true);
  };

  const saveQuote = async () => {
    try {
      if (!customerId) return;
      const col = collection(db, 'customerProfiles', customerId, 'quotesDrafts');
      const items = (form.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
      const subtotal = items.reduce((a,it)=> a + (it.qty*it.unitPrice), 0);
      const taxRate = Number(form.taxRate || 0);
      const discount = Number(form.discount || 0);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount - discount;
      const cur = (form.currency || 'USD').toUpperCase();
      const base = (globalFxBase || 'USD').toUpperCase();
      const rate = Number(form.fxRate || 1);
      const isSame = cur === base;
      const toBase = (n) => isSame ? Number(n||0) : Number(n||0) / (rate || 1);
      await addDoc(col, { client: form.client || '', validUntil: form.validUntil || '', taxRate, discount, items, subtotal, taxAmount, total, currency: (form.currency || undefined), fxBase: (globalFxBase || undefined), fxRate: Number(form.fxRate || 1), subtotalBase: toBase(subtotal), taxAmountBase: toBase(taxAmount), discountBase: toBase(discount), totalBase: toBase(total), status: 'draft', createdAt: serverTimestamp() });
      setShowModal(false);
    } catch {}
  };

  const removeDraft = async (q) => {
    try { await deleteDoc(doc(db, 'customerProfiles', customerId, 'quotesDrafts', q.id)); } catch {}
  };

  

  const printDraft = (q) => { try { renderQuotePdf(q, { title: 'Quotation' }); } catch {} };

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 220px 220px 240px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
          <div>Client</div>
          <div>Valid Until</div>
          <div>Tax %</div>
          <div>Discount (Cust/Base)</div>
          <div>Total (Cust/Base)</div>
          <div>Actions</div>
        </div>
        <div style={{ marginTop: 6 }}>
          {quotes.length === 0 ? (
            <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No draft quotes</div>
          ) : (
            quotes.map((q) => (
              <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px 220px 240px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.client || 'Client'}</div>
                <div>{q.validUntil || '-'}</div>
                <div>{Number(q.taxRate || 0).toFixed(2)}</div>
                <div>{(() => { const cur=(q.currency||'USD').toUpperCase(); const base=(globalFxBase||'USD').toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n||0));}catch{return `${c} ${Number(n||0).toFixed(2)}`;}}; const disc=Number(q.discount||0); let discBase=(typeof q.discountBase==='number' && (q.fxBase||'').toUpperCase()===base)?Number(q.discountBase):NaN; if(!Number.isFinite(discBase)){ const savedRate=Number(q.fxRate||0); if(savedRate>0 && (q.fxBase||'').toUpperCase()===base && cur!==base){ discBase=disc/savedRate; } } if(!Number.isFinite(discBase)){ if(cur===base) discBase=disc; else discBase=disc; } return `${fmt(disc,cur)}  •  ${fmt(discBase,base)}`; })()}</div>
                <div>{(() => { const cur=(q.currency||'USD').toUpperCase(); const base=(globalFxBase||'USD').toUpperCase(); const fmt=(n,c)=>{ try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n||0));}catch{return `${c} ${Number(n||0).toFixed(2)}`;}}; const tot=Number(q.total||0); let totBase=(typeof q.totalBase==='number' && (q.fxBase||'').toUpperCase()===base)?Number(q.totalBase):NaN; if(!Number.isFinite(totBase)){ const savedRate=Number(q.fxRate||0); if(savedRate>0 && (q.fxBase||'').toUpperCase()===base && cur!==base){ totBase=tot/savedRate; } } if(!Number.isFinite(totBase)){ if(cur===base) totBase=tot; else totBase=tot; } return `${fmt(tot,cur)}  •  ${fmt(totBase,base)}`; })()}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => printDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Print</button>
                  {!readOnly && (
                    <>
                      <button onClick={() => setForm({ client: q.client || '', validUntil: q.validUntil || '', taxRate: Number(q.taxRate||0), discount: Number(q.discount||0), items: Array.isArray(q.items) ? q.items.map(it => ({ description: it.description||'', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [] }) || setShowModal(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={() => removeDraft(q)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 140px', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Client</span>
                <input value={form.client} onChange={(e)=> setForm(f=>({ ...f, client: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Valid Until</span>
                <input type="date" value={form.validUntil} onChange={(e)=> setForm(f=>({ ...f, validUntil: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Tax Rate %</span>
                <input type="number" step="0.01" value={form.taxRate} onChange={(e)=> setForm(f=>({ ...f, taxRate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Discount</span>
                <input type="number" step="0.01" value={form.discount} onChange={(e)=> setForm(f=>({ ...f, discount: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>Currency (ISO)</span>
                <input list="proflow-currencies" value={form.currency} onChange={(e)=> setForm(f=>({ ...f, currency: (e.target.value||'').toUpperCase() }))} placeholder="e.g., USD" />
                <datalist id="proflow-currencies">
                  <option value="USD" />
                  <option value="EUR" />
                  <option value="GBP" />
                  <option value="MYR" />
                  <option value="SGD" />
                  <option value="AUD" />
                  <option value="CAD" />
                  <option value="JPY" />
                  <option value="CNY" />
                  <option value="INR" />
                </datalist>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280' }}>
                <span style={{ marginBottom: 4 }}>FX Rate (to base)</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" step="0.0001" value={form.fxRate} onChange={(e)=> setForm(f=>({ ...f, fxRate: e.target.value }))} placeholder="1.0" />
                  <button onClick={async () => {
                    try {
                      const base = (globalFxBase || 'USD').toUpperCase();
                      const cur = (form.currency || 'USD').toUpperCase();
                      const resp = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&api_key=eb803299bef64dc80de605049727ccf4`);
                      const data = await resp.json();
                      if (data && data.rates && data.rates[cur] != null) setForm(f => ({ ...f, fxRate: Number(data.rates[cur]) }));
                    } catch {}
                  }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Fetch Rate</button>
                </div>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, fontSize: 12, color: '#374151' }}>
              {(() => {
                const tax = subtotal * (Number(form.taxRate||0)/100);
                const discount = Number(form.discount||0);
                const total = subtotal + tax - discount;
                const cur = (form.currency || 'USD').toUpperCase();
                const base = (globalFxBase || 'USD').toUpperCase();
                const rate = Number(form.fxRate || 1);
                const isSame = cur === base;
                const toBase = (n) => isSame ? Number(n||0) : Number(n||0) / (rate || 1);
                const fmt = (n,c) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(Number(n||0)); } catch { return `${c} ${Number(n||0).toFixed(2)}`; } };
                return (
                  <>
                    <div>Subtotal: {fmt(subtotal, cur)} ({fmt(toBase(subtotal), base)})</div>
                    <div>Tax: {fmt(tax, cur)} ({fmt(toBase(tax), base)})</div>
                    <div>Discount: {fmt(discount, cur)} ({fmt(toBase(discount), base)})</div>
                    <div style={{ fontWeight: 700, color: '#111827' }}>Total: {fmt(total, cur)} ({fmt(toBase(total), base)})</div>
                  </>
                );
              })()}
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


