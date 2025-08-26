import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc, serverTimestamp, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DESIGN_SYSTEM, getPageContainerStyle, getContentContainerStyle } from '../styles/designSystem';

export default function FinancePage() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('invoices'); // invoices | expenses | quotes | customers | insights
  const [invoiceFilter, setInvoiceFilter] = useState({ status: 'all', customer: 'all' });
  const [expensesRows, setExpensesRows] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [quoteRows, setQuoteRows] = useState([]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showEmailTpl, setShowEmailTpl] = useState(false);
  const [emailTpl, setEmailTpl] = useState({ subject: 'Invoice from ProFlow - {client}', body: 'Dear {client},\n\nPlease find the invoice for {project} due on {dueDate}.\nTotal: {total}\n\nBest regards,\nProFlow' });
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showFinanceDefaults, setShowFinanceDefaults] = useState(false);
  const [financeDefaults, setFinanceDefaults] = useState({
    taxRate: 0,
    discount: 0,
    recipients: '',
    invoiceNumberPrefix: 'INV-',
    nextInvoiceNumber: 1,
    paymentProvider: 'paypal',
    paypalBusinessEmail: '',
    currency: 'USD', // default currency for new invoices
    customPaymentBaseUrl: '',
    reminderDays: '7,3,1'
  });
  const [showQuoteTemplates, setShowQuoteTemplates] = useState(false);
  const [quoteTemplates, setQuoteTemplates] = useState([]);
  const [tplUploadBusy, setTplUploadBusy] = useState(false);
  const [applyTplForQuote, setApplyTplForQuote] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [tplValidation, setTplValidation] = useState({}); // { [id]: { ok:boolean, messages:string[], checking:boolean } }
  const [showAiTpl, setShowAiTpl] = useState(false);
  const [aiTplText, setAiTplText] = useState('');
  const [aiTplBusy, setAiTplBusy] = useState(false);
  const [aiTplError, setAiTplError] = useState('');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ projectId: '', client: '', dueDate: '', items: [], taxRate: 0, discount: 0, currency: '' });
  const [expenseAttachment, setExpenseAttachment] = useState({}); // { [rowIndex]: { file: File, uploading: boolean, url: string } }
  const [invoiceAttachment, setInvoiceAttachment] = useState({}); // for new invoice modal
  const [customersBook, setCustomersBook] = useState([]);
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [fxRates, setFxRates] = useState({ base: 'USD', rates: {} });
  const [fxRatesEditBase, setFxRatesEditBase] = useState('USD');
  const [fxRatesEditText, setFxRatesEditText] = useState('');
  const [showRecurring, setShowRecurring] = useState(false);
  const [recTemplates, setRecTemplates] = useState([]);
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState('');
  const [newRec, setNewRec] = useState({ projectId: '', client: '', frequency: 'monthly', startDate: '', taxRate: 0, discount: 0, items: [] });
  const [showReminders, setShowReminders] = useState(false);
  const [showImportInvoices, setShowImportInvoices] = useState(false);
  const [importInvoicesRows, setImportInvoicesRows] = useState([]);
  const [importInvoicesBusy, setImportInvoicesBusy] = useState(false);
  const [importInvoicesError, setImportInvoicesError] = useState('');
  const [importInvoicesPreview, setImportInvoicesPreview] = useState([]); // [{row, errors:string[]}]
  const [showImportExpenses, setShowImportExpenses] = useState(false);
  const [importExpensesRows, setImportExpensesRows] = useState([]);
  const [importExpensesBusy, setImportExpensesBusy] = useState(false);
  const [importExpensesError, setImportExpensesError] = useState('');
  const [importExpensesPreview, setImportExpensesPreview] = useState([]);

  const resolveProject = (projectField) => {
    if (!projectField) return null;
    return projects.find(p => (p.name || p.id) === projectField || p.id === projectField) || null;
  };

  const isIsoDate = (s) => /^(\d{4})-(\d{2})-(\d{2})$/.test(String(s||''));

  const prepareInvoiceImportPreview = (rows) => {
    const preview = rows.map((r, idx) => {
      const errors = [];
      const project = resolveProject(r.project || r.projectId);
      if (!project) errors.push('Unknown project');
      if (!r.client) errors.push('Missing client');
      if (r.dueDate && !isIsoDate(r.dueDate)) errors.push('Invalid date (YYYY-MM-DD)');
      if (r.status && !['unpaid','paid'].includes(String(r.status).toLowerCase())) errors.push('Invalid status');
      if (r.items && !Array.isArray(r.items)) errors.push('Items must be JSON array');
      const items = Array.isArray(r.items) ? r.items : [];
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0);
      const taxRate = Number(r.taxRate || financeDefaults.taxRate || 0);
      const taxAmount = subtotal * (taxRate/100);
      const discount = Number(r.discount || 0);
      const calculated = subtotal + taxAmount - discount;
      const total = Number((r.total ?? calculated ?? 0));
      if (!Number.isFinite(total)) errors.push('Invalid total');
      return { row: r, errors, projectId: project?.id || null };
    });
    setImportInvoicesPreview(preview);
  };

  const prepareExpenseImportPreview = (rows) => {
    const preview = rows.map((r) => {
      const errors = [];
      const project = resolveProject(r.project || r.projectId);
      if (!project) errors.push('Unknown project');
      if (!r.date || !isIsoDate(r.date)) errors.push('Invalid/missing date (YYYY-MM-DD)');
      const amount = Number(r.amount || 0);
      if (!Number.isFinite(amount) || amount === 0) errors.push('Invalid amount');
      return { row: r, errors, projectId: project?.id || null };
    });
    setImportExpensesPreview(preview);
  };
  const [invoiceSort, setInvoiceSort] = useState({ key: 'projectName', dir: 'asc' });
  const [expenseSort, setExpenseSort] = useState({ key: 'projectName', dir: 'asc' });
  const [quoteSort, setQuoteSort] = useState({ key: 'client', dir: 'asc' });
  const [expenseFilter, setExpenseFilter] = useState({ category: 'all' });
  const [quoteFilter, setQuoteFilter] = useState({ status: 'all' });
  // Field mapper
  // Removed Map Fields flow per request

  useEffect(() => {
    if (!currentUser?.uid) { setProjects([]); return; }
    const unsubs = [];
    const seen = new Map();
    const pushDocs = (docs) => {
      docs.forEach(d => { seen.set(d.id, { id: d.id, ...d.data() }); });
      setProjects(Array.from(seen.values()));
    };
    // Owned by legacy userId
    const q1 = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
    unsubs.push(onSnapshot(q1, (snap) => pushDocs(snap.docs)));
    // Owned by createdBy
    const q2 = query(collection(db, 'projects'), where('createdBy', '==', currentUser.uid));
    unsubs.push(onSnapshot(q2, (snap) => pushDocs(snap.docs)));
    // Member of team
    const q3 = query(collection(db, 'projects'), where('team', 'array-contains', currentUser.uid));
    unsubs.push(onSnapshot(q3, (snap) => pushDocs(snap.docs)));
    return () => unsubs.forEach(u => { try { u(); } catch {} });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) { setQuoteTemplates([]); return; }
    const ref = collection(db, 'users', currentUser.uid, 'quoteTemplates');
    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setQuoteTemplates(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) { setRecTemplates([]); return; }
    const ref = collection(db, 'users', currentUser.uid, 'recurringInvoices');
    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setRecTemplates(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    const loadTpl = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeEmail');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setEmailTpl({
            subject: d.subject || 'Invoice from ProFlow - {client}',
            body: d.body || 'Dear {client},\n\nPlease find the invoice for {project} due on {dueDate}.\nTotal: {total}\n\nBest regards,\nProFlow'
          });
        }
      } catch {}
    };
    loadTpl();
  }, [currentUser?.uid]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        if (!currentUser?.uid) return;
        const ref = doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setFinanceDefaults({
            taxRate: Number(d.taxRate||0),
            discount: Number(d.discount||0),
            recipients: d.recipients || '',
            invoiceNumberPrefix: d.invoiceNumberPrefix || 'INV-',
            nextInvoiceNumber: Number(d.nextInvoiceNumber || 1),
            paymentProvider: d.paymentProvider || 'paypal',
            paypalBusinessEmail: d.paypalBusinessEmail || '',
            currency: d.currency || 'USD',
            customPaymentBaseUrl: d.customPaymentBaseUrl || '',
            reminderDays: d.reminderDays || '7,3,1'
          });
          if (d.fxRates && typeof d.fxRates === 'object') setFxRates(d.fxRates);
          if (d.fxRates?.base) setFxRatesEditBase(d.fxRates.base);
          if (d.fxRates?.rates) setFxRatesEditText(JSON.stringify(d.fxRates.rates, null, 2));
        }
      } catch {}
    };
    loadDefaults();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) { setCustomersBook([]); return; }
    const qref = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(qref, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() || {};
        const name = data.customerProfile?.name || data.companyProfile?.company || d.id;
        const email = data.customerProfile?.email || '';
        const phone = data.customerProfile?.phone || '';
        const currency = data.financeDefaults?.currency || data.customerProfile?.currency || '';
        const taxRate = data.financeDefaults?.taxRate ?? data.customerProfile?.taxRate;
        return { id: d.id, name, email, phone, currency, taxRate };
      }).sort((a,b) => (a.name||'').localeCompare(b.name||''));
      setCustomersBook(list);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubs = [];
    const expBundle = [];
    const invBundle = [];
    const quoBundle = [];
    for (const p of projects) {
      const unsubExp = onSnapshot(collection(db, 'projects', p.id, 'expenses'), (s) => {
        const list = s.docs.map(d => ({ id: d.id, type: 'expense', projectId: p.id, projectName: p.name || p.id, date: d.data().date || '', category: d.data().category || '', amount: Number(d.data().amount || 0), note: d.data().note || '', receiptUrl: d.data().receiptUrl || '' }));
        // replace for project
        for (let i = expBundle.length - 1; i >= 0; i--) if (expBundle[i].projectId === p.id) expBundle.splice(i, 1);
        expBundle.push(...list);
        setExpensesRows([...expBundle]);
      });
      const unsubInv = onSnapshot(collection(db, 'projects', p.id, 'invoices'), (s) => {
        const list = s.docs.map(d => ({
          id: d.id,
          type: 'invoice',
          projectId: p.id,
          projectName: p.name || p.id,
          client: d.data().client || '',
          dueDate: d.data().dueDate || '',
          status: d.data().status || 'unpaid',
          total: Number(d.data().total || 0),
          items: Array.isArray(d.data().items) ? d.data().items : [],
          // include tax/discount/subtotal for UI and printing
          taxRate: Number(d.data().taxRate || 0),
          discount: Number(d.data().discount || 0),
          taxAmount: Number(d.data().taxAmount || 0),
          subtotal: Number(d.data().subtotal || 0),
          currency: d.data().currency || ''
        }));
        for (let i = invBundle.length - 1; i >= 0; i--) if (invBundle[i].projectId === p.id) invBundle.splice(i, 1);
        invBundle.push(...list);
        setInvoiceRows([...invBundle]);
      });
      const unsubQuo = onSnapshot(collection(db, 'projects', p.id, 'quotes'), (s) => {
        const list = s.docs.map(d => ({
          id: d.id,
          type: 'quote',
          projectId: p.id,
          projectName: p.name || p.id,
          client: d.data().client || '',
          validUntil: d.data().validUntil || '',
          status: d.data().status || 'draft',
          total: Number(d.data().total || 0),
          items: Array.isArray(d.data().items) ? d.data().items : [],
          // include tax/discount/subtotal for printing
          taxRate: Number(d.data().taxRate || 0),
          discount: Number(d.data().discount || 0),
          taxAmount: Number(d.data().taxAmount || 0),
          subtotal: Number(d.data().subtotal || 0)
        }));
        for (let i = quoBundle.length - 1; i >= 0; i--) if (quoBundle[i].projectId === p.id) quoBundle.splice(i, 1);
        quoBundle.push(...list);
        setQuoteRows([...quoBundle]);
      });
      unsubs.push(unsubExp, unsubInv, unsubQuo);
    }
    // Also include customer quote drafts (not yet linked to a project)
    // Only my customers' drafts
    const qMyCustomers = query(collection(db, 'customerProfiles'), where('userId', '==', currentUser?.uid || ''));
    const unsubCustDrafts = onSnapshot(qMyCustomers, async (snap) => {
      try {
        const drafts = [];
        for (const d of snap.docs) {
          const cid = d.id;
          const cname = (d.data()?.customerProfile?.name || d.data()?.companyProfile?.company || '(Customer)');
          const qSnap = await (await import('firebase/firestore')).getDocs(collection(db, 'customerProfiles', cid, 'quotesDrafts'));
          qSnap.forEach(qd => {
            const q = qd.data() || {};
            if (!q.projectId) drafts.push({
              id: qd.id,
              type: 'quote_draft',
              projectId: '',
              projectName: '(Customer Draft)',
              client: q.client || '',
              validUntil: q.validUntil || '',
              status: 'draft',
              total: Number(q.total || 0),
              items: Array.isArray(q.items) ? q.items : [],
              customerId: cid,
              // include tax/discount for printing
              taxRate: Number(q.taxRate || 0),
              discount: Number(q.discount || 0),
              taxAmount: Number(q.taxAmount || 0),
              subtotal: Number(q.subtotal || 0)
            });
          });
        }
        // Replace any existing customer-draft rows
        for (let i = quoBundle.length - 1; i >= 0; i--) if (quoBundle[i].type === 'quote_draft') quoBundle.splice(i, 1);
        quoBundle.push(...drafts);
        setQuoteRows([...quoBundle]);
      } catch {}
    });
    return () => { try { unsubs.forEach(u => { try { u(); } catch {} }); } catch {} };
  }, [projects.map(p => p.id).join(',')]);

  // tab sync with URL
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get('tab');
    if (t && ['invoices','expenses','quotes','insights'].includes(t)) setActiveTab(t);
    const cust = sp.get('customer');
    if (cust) setInvoiceFilter(f => ({ ...f, customer: cust }));
  }, [location.search]);

  const setTab = (t) => {
    const sp = new URLSearchParams(location.search);
    sp.set('tab', t);
    navigate(`/finance?${sp.toString()}`, { replace: true });
    setActiveTab(t);
  };

  const customers = useMemo(() => {
    const set = new Set(['all']);
    invoiceRows.forEach(r => set.add(r.client || 'Unassigned'));
    return Array.from(set);
  }, [invoiceRows]);

  const expenseCategories = useMemo(() => {
    const set = new Set(['all']);
    expensesRows.forEach(r => set.add(r.category || 'Uncategorized'));
    return Array.from(set);
  }, [expensesRows]);

  const customersRollup = useMemo(() => {
    const map = {};
    for (const r of invoiceRows) {
      const name = r.client || 'Unassigned';
      const m = map[name] || { name, invoiced: 0, paid: 0, unpaid: 0, count: 0, lastDue: '' };
      m.invoiced += Number(r.total || 0);
      m.count += 1;
      if (r.status === 'paid') m.paid += Number(r.total || 0); else m.unpaid += Number(r.total || 0);
      if (r.dueDate && (!m.lastDue || r.dueDate > m.lastDue)) m.lastDue = r.dueDate;
      map[name] = m;
    }
    return Object.values(map).sort((a,b) => b.unpaid - a.unpaid);
  }, [invoiceRows]);

  const filteredInvoices = invoiceRows.filter(r => {
    if (invoiceFilter.status !== 'all' && r.status !== invoiceFilter.status) return false;
    if (invoiceFilter.customer !== 'all' && (r.client || 'Unassigned') !== invoiceFilter.customer) return false;
    return true;
  });
  const sortedInvoices = useMemo(() => {
    const rows = [...filteredInvoices];
    const { key, dir } = invoiceSort || { key: 'projectName', dir: 'asc' };
    rows.sort((a, b) => {
      if (key === 'total') {
        const va = Number(a.total || 0);
        const vb = Number(b.total || 0);
        return dir === 'asc' ? va - vb : vb - va;
      }
      const va = (a[key] ?? '').toString().toLowerCase();
      const vb = (b[key] ?? '').toString().toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filteredInvoices, invoiceSort]);
  const toggleInvoiceSort = (key) => setInvoiceSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const filteredExpenses = expensesRows.filter(r => {
    if (expenseFilter.category !== 'all' && (r.category || 'Uncategorized') !== expenseFilter.category) return false;
    return true;
  });
  const sortedExpenses = useMemo(() => {
    const rows = [...filteredExpenses];
    const { key, dir } = expenseSort || { key: 'projectName', dir: 'asc' };
    rows.sort((a, b) => {
      const vaRaw = a[key];
      const vbRaw = b[key];
      const isNum = typeof vaRaw === 'number' || typeof vbRaw === 'number';
      if (isNum) {
        const va = Number(vaRaw || 0);
        const vb = Number(vbRaw || 0);
        return dir === 'asc' ? va - vb : vb - va;
      }
      const va = (vaRaw ?? '').toString().toLowerCase();
      const vb = (vbRaw ?? '').toString().toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filteredExpenses, expenseSort]);
  const toggleExpenseSort = (key) => setExpenseSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const filteredQuotes = quoteRows.filter(r => {
    if (quoteFilter.status !== 'all' && (r.status || 'draft') !== quoteFilter.status) return false;
    return true;
  });
  const sortedQuotes = useMemo(() => {
    const rows = [...filteredQuotes];
    const { key, dir } = quoteSort || { key: 'client', dir: 'asc' };
    rows.sort((a, b) => {
      const vaRaw = a[key];
      const vbRaw = b[key];
      const isNum = typeof vaRaw === 'number' || typeof vbRaw === 'number';
      if (isNum) {
        const va = Number(vaRaw || 0);
        const vb = Number(vbRaw || 0);
        return dir === 'asc' ? va - vb : vb - va;
      }
      const va = (vaRaw ?? '').toString().toLowerCase();
      const vb = (vbRaw ?? '').toString().toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filteredQuotes, quoteSort]);
  const toggleQuoteSort = (key) => setQuoteSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const baseCurrency = financeDefaults.currency || 'USD';
  const getFxRate = (code) => {
    const c = (code || baseCurrency || 'USD').toUpperCase();
    if (c === (baseCurrency || 'USD').toUpperCase()) return 1;
    const rate = fxRates?.rates?.[c];
    return Number(rate || 1);
  };
  const invTotal = filteredInvoices.reduce((a,b) => a + (b.total||0), 0);
  const invUnpaid = filteredInvoices.filter(r => r.status !== 'paid').reduce((a,b) => a + (b.total||0), 0);
  const invTotalBase = filteredInvoices.reduce((a,b) => a + (Number(b.total||0) * getFxRate(b.currency)), 0);
  const invUnpaidBase = filteredInvoices.filter(r => r.status !== 'paid').reduce((a,b) => a + (Number(b.total||0) * getFxRate(b.currency)), 0);

  const insights = useMemo(() => {
    const now = new Date();
    const parseDate = (s) => { try { return s ? new Date(s) : null; } catch { return null; } };
    const daysBetween = (a, b) => Math.ceil((a - b) / (1000*60*60*24));
    // Aging buckets for unpaid
    const unpaid = invoiceRows.filter(r => r.status !== 'paid');
    const buckets = { notDue: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    unpaid.forEach(r => {
      const due = parseDate(r.dueDate);
      const baseAmt = Number(r.total||0) * getFxRate(r.currency);
      if (!due || due > now) { buckets.notDue += baseAmt; return; }
      const days = daysBetween(now, due);
      if (days <= 30) buckets.d0_30 += baseAmt;
      else if (days <= 60) buckets.d31_60 += baseAmt;
      else if (days <= 90) buckets.d61_90 += baseAmt;
      else buckets.d90p += baseAmt;
    });
    // Revenue by month (paid)
    const paid = invoiceRows.filter(r => r.status === 'paid');
    const monthly = {};
    paid.forEach(r => {
      const d = parseDate(r.dueDate) || parseDate(r.createdAt?.toDate ? r.createdAt.toDate().toISOString().slice(0,10) : '') || now;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const baseAmt = Number(r.total||0) * getFxRate(r.currency);
      monthly[key] = (monthly[key] || 0) + baseAmt;
    });
    // Last 6 months timeline
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months.push({ key, value: Number((monthly[key] || 0)) });
    }
    return { buckets, months };
  }, [invoiceRows, fxRates, financeDefaults.currency]);
  const expTotal = expensesRows.reduce((a,b) => a + (b.amount||0), 0);

  const convertQuoteToInvoice = async (q) => {
    try {
      if (!q?.projectId) return;
      const items = Array.isArray(q.items) ? q.items.map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [];
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxRate = Number(q.taxRate || 0);
      const discount = Number(q.discount || 0);
      const taxAmount = subtotal * (taxRate/100);
      const total = Number((q.total ?? (subtotal + taxAmount - discount)) || 0);
      await addDoc(collection(db, 'projects', q.projectId, 'invoices'), {
        client: q.client || '',
        dueDate: q.validUntil || '',
        status: 'unpaid',
        items,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total,
        createdAt: serverTimestamp()
      });
      // Optionally update quote status
      await updateDoc(doc(db, 'projects', q.projectId, 'quotes', q.id), { status: 'converted', convertedAt: serverTimestamp() });
      setActiveTab('invoices');
    } catch {}
  };

  const [newQuote, setNewQuote] = useState({ projectId: '', client: '', total: '', validUntil: '' });
  const saveNewQuote = async () => {
    try {
      if (!newQuote.projectId || !newQuote.client) return;
      const items = Array.isArray(newQuote.items) ? newQuote.items.map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [];
      const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxRate = Number(newQuote.taxRate || 0);
      const discount = Number(newQuote.discount || 0);
      const taxAmount = subtotal * (taxRate/100);
      const total = (newQuote.total !== undefined && newQuote.total !== '') ? Number(newQuote.total || 0) : (subtotal + taxAmount - discount);
      await addDoc(collection(db, 'projects', newQuote.projectId, 'quotes'), {
        client: newQuote.client,
        validUntil: newQuote.validUntil || '',
        items,
        subtotal,
        taxRate,
        discount,
        taxAmount,
        total: Number(total || 0),
        status: 'draft',
        createdAt: serverTimestamp()
      });
      setShowQuoteModal(false);
      setNewQuote({ projectId: '', client: '', validUntil: '', items: [], taxRate: 0, discount: 0, total: '' });
    } catch {}
  };

  const printInvoice = (inv) => {
    try {
      const items = Array.isArray(inv.items) ? inv.items : [];
      const hasItems = items.length > 0;
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxRate = Number(inv.taxRate || 0);
      const discount = Number(inv.discount || 0);
      const taxAmount = hasItems ? (subtotal * (taxRate/100)) : Number(inv.taxAmount || 0);
      const total = Number((inv.total ?? (hasItems ? (subtotal + taxAmount - discount) : 0)) || 0);
      const rows = hasItems
        ? items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td style="text-align:right">${Number(it.qty||0)}</td><td style="text-align:right">${Number(it.unitPrice||0).toFixed(2)}</td><td style="text-align:right">${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')
        : `<tr><td>Invoice Total</td><td style="text-align:right">${total.toFixed(2)}</td></tr>`;
      const totalsRow = hasItems
        ? `<tr><td colspan="3" class="total">Subtotal</td><td class="total" style="text-align:right">${subtotal.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Tax (${taxRate.toFixed(2)}%)</td><td class="total" style="text-align:right">${taxAmount.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Discount</td><td class="total" style="text-align:right">${discount.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Total</td><td class="total" style="text-align:right">${total.toFixed(2)}</td></tr>`
        : `<tr><td class="total">Total</td><td class="total" style="text-align:right">${total.toFixed(2)}</td></tr>`;
      const table = hasItems
        ? `<table><thead><tr><th>Description</th><th style="width:100px;text-align:right">Qty</th><th style="width:140px;text-align:right">Unit Price</th><th style="width:140px;text-align:right">Amount</th></tr></thead><tbody>${rows}${totalsRow}</tbody></table>`
        : `<table><thead><tr><th>Description</th><th style="width:140px;text-align:right">Amount</th></tr></thead><tbody>${rows}${totalsRow}</tbody></table>`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice - ${inv.client || ''}</title><style>
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
            <div class="muted">Invoice</div>
          </div>
          <div class="muted">
            <div>Project: ${inv.projectName || ''}</div>
            <div>Client: ${inv.client || ''}</div>
            <div>Due: ${inv.dueDate || '-'}</div>
            <div>Status: ${inv.status || 'unpaid'}</div>
            <div>Tax Rate: ${taxRate.toFixed(2)}%</div>
            <div>Discount: ${discount.toFixed(2)}</div>
          </div>
        </div>
        ${table}
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
    } catch {}
  };

  const buildPaymentUrl = (inv) => {
    const amount = Number(inv.total || 0).toFixed(2);
    const number = inv.number || `${inv.projectName || 'INV'}-${inv.id || ''}`;
    if ((financeDefaults.paymentProvider || 'paypal') === 'paypal') {
      const business = financeDefaults.paypalBusinessEmail || '';
      const currency = financeDefaults.currency || 'USD';
      const itemName = encodeURIComponent(`Invoice ${number}`);
      return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(business)}&item_name=${itemName}&amount=${encodeURIComponent(amount)}&currency_code=${encodeURIComponent(currency)}`;
    }
    const base = financeDefaults.customPaymentBaseUrl || '';
    return base
      .replace('{amount}', amount)
      .replace('{number}', encodeURIComponent(number))
      .replace('{project}', encodeURIComponent(inv.projectName || ''))
      .replace('{client}', encodeURIComponent(inv.client || ''));
  };

  const openPaymentLink = (inv) => {
    try { const url = buildPaymentUrl(inv); if (url) window.open(url, '_blank'); } catch {}
  };

  const [recordPaymentFor, setRecordPaymentFor] = useState(null);
  const openRecordPayment = (inv) => setRecordPaymentFor(inv);

  const printQuote = (q) => {
    try {
      const items = Array.isArray(q.items) ? q.items : [];
      const hasItems = items.length > 0;
      const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
      const taxRate = Number(q.taxRate || 0);
      const discount = Number(q.discount || 0);
      const taxAmount = hasItems ? (subtotal * (taxRate/100)) : Number(q.taxAmount || 0);
      const total = Number((q.total ?? (hasItems ? (subtotal + taxAmount - discount) : 0)) || 0);
      const rows = hasItems
        ? items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td style="text-align:right">${Number(it.qty||0)}</td><td style="text-align:right">${Number(it.unitPrice||0).toFixed(2)}</td><td style="text-align:right">${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')
        : `<tr><td>Quoted Total</td><td style="text-align:right">${total.toFixed(2)}</td></tr>`;
      const totalsRow = hasItems
        ? `<tr><td colspan="3" class="total">Subtotal</td><td class="total" style="text-align:right">${subtotal.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Tax (${taxRate.toFixed(2)}%)</td><td class="total" style="text-align:right">${taxAmount.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Discount</td><td class="total" style="text-align:right">${discount.toFixed(2)}</td></tr>`
          + `<tr><td colspan="3" class="total">Total</td><td class="total" style="text-align:right">${total.toFixed(2)}</td></tr>`
        : `<tr><td class="total">Total</td><td class="total" style="text-align:right">${total.toFixed(2)}</td></tr>`;
      const table = hasItems
        ? `<table><thead><tr><th>Description</th><th style="width:100px;text-align:right">Qty</th><th style="width:140px;text-align:right">Unit Price</th><th style="width:140px;text-align:right">Amount</th></tr></thead><tbody>${rows}${totalsRow}</tbody></table>`
        : `<table><thead><tr><th>Description</th><th style="width:140px;text-align:right">Amount</th></tr></thead><tbody>${rows}${totalsRow}</tbody></table>`;
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
            <div class="muted">Quote</div>
          </div>
          <div class="muted">
            <div>Project: ${q.projectName || ''}</div>
            <div>Client: ${q.client || ''}</div>
            <div>Valid Until: ${q.validUntil || '-'}</div>
            <div>Status: ${q.status || 'draft'}</div>
            <div>Tax Rate: ${taxRate.toFixed(2)}%</div>
            <div>Discount: ${discount.toFixed(2)}</div>
          </div>
        </div>
        ${table}
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
    } catch {}
  };
  const renderQuoteWithTemplate = (tplContent, q) => {
    try {
      const items = Array.isArray(q.items) ? q.items : [];
      const rows = items.length > 0
        ? items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td style="text-align:right">${Number(it.qty||0)}</td><td style="text-align:right">${Number(it.unitPrice||0).toFixed(2)}</td><td style="text-align:right">${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')
        : `<tr><td>Quoted Total</td><td></td><td></td><td style="text-align:right">${Number(q.total||0).toFixed(2)}</td></tr>`;
      const table = `
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr><th style="text-align:left;border:1px solid #e5e7eb;padding:8px">Description</th><th style="width:100px;text-align:right;border:1px solid #e5e7eb;padding:8px">Qty</th><th style="width:140px;text-align:right;border:1px solid #e5e7eb;padding:8px">Unit Price</th><th style="width:140px;text-align:right;border:1px solid #e5e7eb;padding:8px">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      const vars = {
        '{client}': q.client || '',
        '{project}': q.projectName || '',
        '{validUntil}': q.validUntil || '',
        '{status}': q.status || 'draft',
        '{total}': Number(q.total||0).toFixed(2),
        '{items_rows}': rows,
        '{items_table}': table
      };
      let html = String(tplContent || '');
      for (const [k,v] of Object.entries(vars)) html = html.replaceAll(k, v);
      if (!/\<html[\s\S]*\<\/html\>/i.test(html)) {
        html = `<!doctype html><html><head><meta charset="utf-8"><title>Quote - ${q.client||''}</title></head><body>${html}</body></html>`;
      }
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
    } catch {}
  };
  const renderQuoteWithTemplateOverrides = (tplContent, q, overrides = {}) => {
    try {
      const items = Array.isArray(q.items) ? q.items : [];
      const rows = items.length > 0
        ? items.map(it => `<tr><td>${(it.description||'').replace(/</g,'&lt;')}</td><td style="text-align:right">${Number(it.qty||0)}</td><td style="text-align:right">${Number(it.unitPrice||0).toFixed(2)}</td><td style="text-align:right">${(Number(it.qty||0)*Number(it.unitPrice||0)).toFixed(2)}</td></tr>`).join('')
        : `<tr><td>Quoted Total</td><td></td><td></td><td style="text-align:right">${Number(q.total||0).toFixed(2)}</td></tr>`;
      const table = `
        <table style=\"width:100%;border-collapse:collapse;margin-top:12px\">\n\
          <thead><tr><th style=\"text-align:left;border:1px solid #e5e7eb;padding:8px\">Description</th><th style=\"width:100px;text-align:right;border:1px solid #e5e7eb;padding:8px\">Qty</th><th style=\"width:140px;text-align:right;border:1px solid #e5e7eb;padding:8px\">Unit Price</th><th style=\"width:140px;text-align:right;border:1px solid #e5e7eb;padding:8px\">Amount</th></tr></thead>\n\
          <tbody>${rows}</tbody>\n\
        </table>`;
      const baseVars = {
        '{client}': q.client || '',
        '{project}': q.projectName || '',
        '{validUntil}': q.validUntil || '',
        '{status}': q.status || 'draft',
        '{total}': Number(q.total||0).toFixed(2),
        '{items_rows}': rows,
        '{items_table}': table
      };
      const merged = { ...baseVars };
      Object.entries(overrides).forEach(([k,v]) => { merged[`{${k}}`] = v; });
      let html = String(tplContent || '');
      for (const [k,v] of Object.entries(merged)) html = html.replaceAll(k, v);
      if (!/\<html[\s\S]*\<\/html\>/i.test(html)) {
        html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Quote - ${q.client||''}</title></head><body>${html}</body></html>`;
      }
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print();
    } catch {}
  };

  const downloadArrayBuffer = async (url) => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to download template');
    return await resp.arrayBuffer();
  };

  const fillDocxTemplate = async (tpl, q, overrides = {}) => {
    try {
      const ab = await downloadArrayBuffer(tpl.downloadURL);
      const PizZip = (await import('pizzip')).default;
      const Docxtemplater = (await import('docxtemplater')).default;
      const zip = new PizZip(ab);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const items = Array.isArray(q.items) ? q.items.map(it => ({
        description: it.description || '',
        qty: Number(it.qty||0),
        unitPrice: Number(it.unitPrice||0).toFixed(2),
        amount: (Number(it.qty||0) * Number(it.unitPrice||0)).toFixed(2)
      })) : [];
      const total = (typeof q.total === 'number' ? q.total : (items.reduce((a,it)=> a + Number(it.amount||0), 0))) || 0;
      doc.setData({
        client: q.client || '',
        project: q.projectName || '',
        validUntil: q.validUntil || '',
        status: q.status || 'draft',
        total: Number(total||0).toFixed(2),
        items
      });
      Object.entries(overrides).forEach(([k,v]) => { try { doc.setData({ [k]: v }); } catch {} });
      doc.render();
      const out = doc.getZip().generate({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `Quote_${(q.client||'client').replace(/[^a-z0-9]+/gi,'_')}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.warn('DOCX fill failed', e);
      try { window.open(tpl.downloadURL, '_blank'); } catch {}
    }
  };

  const fillPdfTemplate = async (tpl, q, overrides = {}) => {
    try {
      const ab = await downloadArrayBuffer(tpl.downloadURL);
      const pdfLib = await import('pdf-lib');
      const pdfDoc = await pdfLib.PDFDocument.load(ab);
      const form = pdfDoc.getForm();
      const trySet = (name, value) => {
        try { const f = form.getTextField(name); f.setText(String(value ?? '')); } catch {}
      };
      trySet('client', overrides.client ?? (q.client ?? ''));
      trySet('project', overrides.project ?? (q.projectName ?? ''));
      trySet('validUntil', overrides.validUntil ?? (q.validUntil ?? ''));
      trySet('status', overrides.status ?? (q.status ?? 'draft'));
      const items = Array.isArray(q.items) ? q.items : [];
      const total = (typeof q.total === 'number' ? q.total : (items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0))) || 0;
      trySet('total', overrides.total ?? Number(total||0).toFixed(2));
      try { form.flatten(); } catch {}
      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Quote_${(q.client||'client').replace(/[^a-z0-9]+/gi,'_')}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.warn('PDF fill failed (ensure AcroForm fields exist)', e);
      try { window.open(tpl.downloadURL, '_blank'); } catch {}
    }
  };

  const validateHtmlTemplate = (content) => {
    const required = ['{client}','{project}','{validUntil}','{total}'];
    const messages = [];
    const missing = required.filter(tag => !content.includes(tag));
    if (missing.length) messages.push(`Missing placeholders: ${missing.join(', ')}`);
    if (!content.includes('{items_rows}') && !content.includes('{items_table}')) {
      messages.push('Items section not found: include {items_rows} or {items_table}.');
    }
    return { ok: messages.length === 0, messages };
  };

  const validateDocxTemplate = async (tpl) => {
    const messages = [];
    try {
      const ab = await downloadArrayBuffer(tpl.downloadURL);
      const PizZip = (await import('pizzip')).default;
      const Docxtemplater = (await import('docxtemplater')).default;
      const zip = new PizZip(ab);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const sample = {
        client: 'Acme Co.',
        project: 'Website Redesign',
        validUntil: '2025-12-31',
        status: 'draft',
        total: '1234.56',
        items: [
          { description: 'Design', qty: 1, unitPrice: '1000.00', amount: '1000.00' },
          { description: 'Hosting', qty: 1, unitPrice: '234.56', amount: '234.56' }
        ]
      };
      doc.setData(sample);
      doc.render();
      return { ok: true, messages };
    } catch (e) {
      const msg = (e && e.message) ? String(e.message) : 'Template error';
      messages.push(`DOCX template error: ${msg}`);
      return { ok: false, messages };
    }
  };

  const validatePdfTemplate = async (tpl) => {
    const messages = [];
    try {
      const ab = await downloadArrayBuffer(tpl.downloadURL);
      const pdfLib = await import('pdf-lib');
      const pdfDoc = await pdfLib.PDFDocument.load(ab);
      let form;
      try { form = pdfDoc.getForm(); } catch {}
      if (!form) {
        messages.push('PDF has no form fields (AcroForm not found).');
        return { ok: false, messages };
      }
      const required = ['client','project','validUntil','status','total'];
      const missing = [];
      for (const name of required) {
        try { form.getTextField(name); } catch { missing.push(name); }
      }
      if (missing.length) messages.push(`Missing form fields: ${missing.join(', ')}`);
      return { ok: messages.length === 0, messages };
    } catch (e) {
      messages.push('Failed to open PDF; ensure it is not password-protected and is a valid AcroForm PDF.');
      return { ok: false, messages };
    }
  };

  const validateTemplate = async (t) => {
    setTplValidation(prev => ({ ...prev, [t.id]: { checking: true, ok: false, messages: [] } }));
    try {
      let res;
      const kind = (t.kind || 'html');
      if (kind === 'html') {
        res = validateHtmlTemplate(t.content || '');
      } else if (kind === 'docx') {
        res = await validateDocxTemplate(t);
      } else if (kind === 'pdf') {
        res = await validatePdfTemplate(t);
      } else {
        res = { ok: false, messages: ['Unsupported template type.'] };
      }
      setTplValidation(prev => ({ ...prev, [t.id]: { checking: false, ok: res.ok, messages: res.messages } }));
    } catch {
      setTplValidation(prev => ({ ...prev, [t.id]: { checking: false, ok: false, messages: ['Validation failed.'] } }));
    }
  };

  // Field mapper removed

  const updateInvoiceStatus = async (inv, newStatus) => {
    try {
      if (!inv?.projectId || !inv?.id) return;
      await updateDoc(doc(db, 'projects', inv.projectId, 'invoices', inv.id), { status: newStatus });
    } catch {}
  };

  const sendInvoiceEmail = async (inv) => {
    try {
      const vars = {
        '{client}': inv.client || '',
        '{project}': inv.projectName || '',
        '{dueDate}': inv.dueDate || '-',
        '{total}': Number(inv.total||0).toFixed(2),
        '{status}': inv.status || 'unpaid'
      };
      const subj = Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(k, v), emailTpl.subject || 'Invoice from ProFlow - {client}');
      const bodyTxt = Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(k, v), emailTpl.body || '');
      const subject = encodeURIComponent(subj);
      const body = encodeURIComponent(bodyTxt);
      const toRaw = (financeDefaults?.recipients || '').trim();
      const to = toRaw.split(',').map(s => s.trim()).filter(Boolean).join(',');
      const mailtoBase = to ? `mailto:${to}` : 'mailto:';
      window.location.href = `${mailtoBase}?subject=${subject}&body=${body}`;
      // Optionally note send time
      if (inv?.projectId && inv?.id) {
        try { await updateDoc(doc(db, 'projects', inv.projectId, 'invoices', inv.id), { emailedAt: serverTimestamp() }); } catch {}
      }
    } catch {}
  };

  const printStatement = (customer, invs) => {
    try {
      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Statement - ${customer}</title><style>
        body{font-family:Arial,sans-serif;color:#111827;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
        .brand{font-weight:700;font-size:20px}
        .muted{color:#6b7280;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
        .total{font-weight:700}
      </style></head><body>
        <div class=\"head\"><div><div class=\"brand\">ProFlow</div><div class=\"muted\">Customer Statement</div></div><div class=\"muted\">Customer: ${customer}</div></div>
        <table>
          <thead><tr><th>Project</th><th>Due</th><th>Status</th><th style=\"width:140px\">Amount</th></tr></thead>
          <tbody>
            ${invs.map(r => `<tr><td>${r.projectName||''}</td><td>${r.dueDate||'-'}</td><td>${r.status||'unpaid'}</td><td>${Number(r.total||0).toFixed(2)}</td></tr>`).join('')}
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
    <div style={getPageContainerStyle()}>
      <TopBar />
      <div style={{ ...getContentContainerStyle(), paddingTop: DESIGN_SYSTEM.spacing['2xl'] }}>
        {/* Header */}
        <div style={{
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.pageThemes.finance.gradient,
          borderRadius: DESIGN_SYSTEM.borderRadius.lg,
          padding: `${DESIGN_SYSTEM.spacing['2xl']} 0`,
          boxShadow: DESIGN_SYSTEM.shadows.lg,
          color: DESIGN_SYSTEM.colors.text.inverse,
          textAlign: 'center'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: DESIGN_SYSTEM.typography.fontSize['3xl'],
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
            marginBottom: DESIGN_SYSTEM.spacing.sm
          }}>
            Finance
          </h1>
          <p style={{
            margin: 0,
            fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            opacity: 0.9
          }}>
            Cross‑project finance management (invoices, expenses, quotes, insights)
          </p>
        </div>

        <div style={{ background: DESIGN_SYSTEM.colors.background.primary, borderRadius: DESIGN_SYSTEM.borderRadius.lg, boxShadow: DESIGN_SYSTEM.shadows.sm, padding: DESIGN_SYSTEM.spacing.base }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['invoices','expenses','quotes','customers','insights'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  border: `1px solid ${activeTab === t ? DESIGN_SYSTEM.pageThemes.finance.accent : DESIGN_SYSTEM.colors.secondary[300]}`,
                  background: activeTab === t ? DESIGN_SYSTEM.pageThemes.finance.cardGradient : DESIGN_SYSTEM.colors.background.primary,
                  cursor: 'pointer',
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                  textTransform: 'capitalize'
                }}
              >{t}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Stat label={`Expenses (${baseCurrency})`} value={expTotal} />
              <Stat label={`Invoiced (${baseCurrency})`} value={invTotalBase} />
              <Stat label={`Unpaid (${baseCurrency})`} value={invUnpaidBase} />
            </div>
          </div>

            {activeTab === 'invoices' && (
              <>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Invoices</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>
                    Status
                    <select value={invoiceFilter.status} onChange={(e) => setInvoiceFilter(f => ({ ...f, status: e.target.value }))} style={{ display: 'block', marginTop: 4 }}>
                      <option value="all">All</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>
                    Customer
                    <select value={invoiceFilter.customer} onChange={(e) => setInvoiceFilter(f => ({ ...f, customer: e.target.value }))} style={{ display: 'block', marginTop: 4 }}>
                      {customers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowEmailTpl(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Email Template</button>
                      <button onClick={() => exportInvoicesCsv(sortedInvoices)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                      <button onClick={() => setShowImportInvoices(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Import CSV</button>
                    </div>
                    <div>
                      <button onClick={() => setShowNewInvoice(true)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>+ New Invoice</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 100px 100px 120px 200px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600, background: '#f9fafb', padding: '6px 8px', borderRadius: 8 }}>
                    <div onClick={() => toggleInvoiceSort('projectName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Project {invoiceSort.key === 'projectName' ? (invoiceSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </div>
                    <div onClick={() => toggleInvoiceSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Client {invoiceSort.key === 'client' ? (invoiceSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </div>
                    <div onClick={() => toggleInvoiceSort('dueDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Due {invoiceSort.key === 'dueDate' ? (invoiceSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </div>
                    <div>Tax %</div>
                    <div>Discount</div>
                    <div onClick={() => toggleInvoiceSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Amount {invoiceSort.key === 'total' ? (invoiceSort.dir === 'asc' ? '↑' : '↓') : ''}
                    </div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {filteredInvoices.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No invoices</div>
                    ) : (
                      sortedInvoices.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 100px 100px 120px 200px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'Client'}</div>
                          <div>{r.dueDate || '-'}</div>
                          <div>{Number(r.taxRate || 0).toFixed(2)}</div>
                          <div>{Number(r.discount || 0).toFixed(2)}</div>
                          <div>{r.total.toFixed(2)} {r.currency || financeDefaults.currency || 'USD'}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => { setEditInvoice(r); setShowInvoiceModal(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                            <select value={r.status} onChange={(e) => updateInvoiceStatus(r, e.target.value)} style={{ padding: '4px 6px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                            </select>
                            <button onClick={() => sendInvoiceEmail(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Email</button>
                            <button onClick={() => openPaymentLink(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Pay</button>
                            <button onClick={() => openRecordPayment(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Record Payment</button>
                            <button onClick={() => printInvoice(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Print</button>

                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'expenses' && (
              <>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Expenses</div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label style={{ fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary }}>
                        Category
                        <select value={expenseFilter.category} onChange={(e) => setExpenseFilter(f => ({ ...f, category: e.target.value }))} style={{ display: 'block', marginTop: 4 }}>
                          {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => exportExpensesCsv(sortedExpenses)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                      <button onClick={() => setShowImportExpenses(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Import CSV</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px 160px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600, background: '#f9fafb', padding: '6px 8px', borderRadius: 8 }}>
                    <div onClick={() => toggleExpenseSort('projectName')} style={{ cursor: 'pointer', userSelect: 'none' }}>Project {expenseSort.key === 'projectName' ? (expenseSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleExpenseSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>Category {expenseSort.key === 'category' ? (expenseSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleExpenseSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>Date {expenseSort.key === 'date' ? (expenseSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleExpenseSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>Amount {expenseSort.key === 'amount' ? (expenseSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div>Receipt</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {sortedExpenses.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No expenses</div>
                    ) : (
                      sortedExpenses.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 120px 160px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div>{r.category || '-'}</div>
                          <div>{r.date || '-'}</div>
                          <div>{r.amount.toFixed(2)}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {r.receiptUrl ? (
                              <a href={r.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View</a>
                            ) : (
                              <span style={{ fontSize: 12, color: '#6b7280' }}>No receipt</span>
                            )}
                            {r.id && (
                              <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
                                const file = e.target.files && e.target.files[0];
                                if (!file) return;
                                try {
                                  const path = `expense_receipts/${r.projectId}/${r.id}_${Date.now()}_${file.name}`;
                                  const sref = storageRef(storage, path);
                                  await uploadBytes(sref, file);
                                  const url = await getDownloadURL(sref);
                                  await updateDoc(doc(db, 'projects', r.projectId, 'expenses', r.id), { receiptUrl: url, receiptPath: path });
                                } catch {}
                              }} />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'quotes' && (
              <>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Quotes</div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowFinanceDefaults(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Finance Settings</button>
                      <button onClick={() => setShowRecurring(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Recurring</button>
                      <button onClick={() => setShowReminders(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Send Reminders</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => exportQuotesCsv(quoteRows)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                      <button onClick={() => setShowQuoteTemplates(true)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Templates</button>
                      <button onClick={() => { setNewQuote({ customerId: '', isNewCustomer: false, newCustomer: { name: '', email: '', phone: '', company: '' }, client: '', validUntil: '', items: [], taxRate: financeDefaults.taxRate || 0, discount: financeDefaults.discount || 0, currency: financeDefaults.currency || 'USD' }); setShowQuoteModal(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>+ New Quote</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 160px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600, background: '#f9fafb', padding: '6px 8px', borderRadius: 8 }}>
                    <div onClick={() => toggleQuoteSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>Client {quoteSort.key === 'client' ? (quoteSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleQuoteSort('projectName')} style={{ cursor: 'pointer', userSelect: 'none' }}>Project {quoteSort.key === 'projectName' ? (quoteSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleQuoteSort('validUntil')} style={{ cursor: 'pointer', userSelect: 'none' }}>Valid Until {quoteSort.key === 'validUntil' ? (quoteSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div onClick={() => toggleQuoteSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>Amount {quoteSort.key === 'total' ? (quoteSort.dir === 'asc' ? '↑' : '↓') : ''}</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {sortedQuotes.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No quotes</div>
                    ) : (
                      sortedQuotes.map((r, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 120px 160px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'Client'}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                          <div>{r.validUntil || '-'}</div>
                          <div>{r.total.toFixed(2)} {r.currency || financeDefaults.currency || 'USD'}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button disabled={r.status === 'converted' || r.type === 'quote_draft'} onClick={() => convertQuoteToInvoice(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: (r.status === 'converted' || r.type === 'quote_draft') ? 'not-allowed' : 'pointer', opacity: (r.status === 'converted' || r.type === 'quote_draft') ? 0.6 : 1, fontSize: 12 }}>{r.type === 'quote_draft' ? 'Draft (convert via project)' : (r.status === 'converted' ? 'Converted' : 'Convert to Invoice')}</button>
                            <button onClick={() => printQuote(r)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Print</button>
                            <button onClick={() => { setApplyTplForQuote(r); setSelectedTemplateId(quoteTemplates[0]?.id || ''); }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary, cursor: 'pointer', fontSize: 12 }}>Print (Template)</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <QuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} customers={customersBook} value={newQuote} onChange={setNewQuote} onSave={saveNewQuote} />
              </>
            )}

            {activeTab === 'insights' && (
              <>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Insights</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Stat label={`Total Expenses (${baseCurrency})`} value={expTotal} />
                  <Stat label={`Total Invoiced (${baseCurrency})`} value={invTotalBase} />
                  <Stat label={`Unpaid Invoices (${baseCurrency})`} value={invUnpaidBase} />
                </div>
                <div style={{ marginTop: 12, background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>AR Aging ({baseCurrency})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                    <Stat label="Not due" value={insights.buckets.notDue} />
                    <Stat label="0-30" value={insights.buckets.d0_30} />
                    <Stat label="31-60" value={insights.buckets.d31_60} />
                    <Stat label="61-90" value={insights.buckets.d61_90} />
                    <Stat label=">90" value={insights.buckets.d90p} />
                  </div>
                </div>
                <div style={{ marginTop: 12, background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Revenue (last 6 months, {baseCurrency})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
                    {insights.months.map(m => (
                      <div key={m.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{m.key}</div>
                        <div style={{ fontWeight: 700 }}>{m.value.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'customers' && (
              <>
                <div style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.lg, fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold, marginBottom: 8 }}>Customers</div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button onClick={() => exportCustomersCsv(customersRollup)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px 120px 140px', gap: 8, fontSize: 12, color: DESIGN_SYSTEM.colors.text.secondary, fontWeight: 600 }}>
                    <div>Customer</div>
                    <div>Invoiced</div>
                    <div>Paid</div>
                    <div>Unpaid</div>
                    <div># Inv</div>
                    <div>Last Due</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {customersRollup.length === 0 ? (
                      <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontStyle: 'italic' }}>No data</div>
                    ) : (
                      customersRollup.map((c, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 80px 120px 140px', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <div>
                            <a href={`#/customer/${encodeURIComponent(c.name)}`} onClick={(e) => { e.preventDefault(); const cust = customersBook.find(x => x.name === c.name); if (cust) window.location.hash = `#/customer/${cust.id}`; else window.location.hash = `#/finance?tab=invoices&customer=${encodeURIComponent(c.name)}`; }} style={{ color: '#2563eb', textDecoration: 'none' }}>{c.name}</a>
                          </div>
                          <div>{c.invoiced.toFixed(2)} {financeDefaults.currency || 'USD'}</div>
                          <div>{c.paid.toFixed(2)} {financeDefaults.currency || 'USD'}</div>
                          <div style={{ color: c.unpaid > 0 ? '#b91c1c' : DESIGN_SYSTEM.colors.text.primary }}>{c.unpaid.toFixed(2)} {financeDefaults.currency || 'USD'}</div>
                          <div>{c.count}</div>
                          <div>{c.lastDue || '-'}</div>
                          <div>
                            <button onClick={() => setStatementCustomer(c.name)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Statement</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
        </div>
      </div>
      {showEmailTpl && (
        <Modal title="Invoice Email Template" onClose={() => setShowEmailTpl(false)} onSave={async () => {
          try {
            if (!currentUser?.uid) return;
            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeEmail'), emailTpl, { merge: true });
            setShowEmailTpl(false);
            // lightweight cache
            localStorage.setItem(`proflow_notif_settings_${currentUser.uid}`, JSON.stringify({ dueSoonHours: 24 }));
          } catch {
            setShowEmailTpl(false);
          }
        }}>
          <Field label="Subject"><input value={emailTpl.subject} onChange={(e) => setEmailTpl(t => ({ ...t, subject: e.target.value }))} /></Field>
          <Field label="Body"><textarea value={emailTpl.body} onChange={(e) => setEmailTpl(t => ({ ...t, body: e.target.value }))} style={{ width: '100%', minHeight: 140, boxSizing: 'border-box' }} /></Field>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Placeholders: {`{client}`} {`{project}`} {`{dueDate}`} {`{total}`} {`{status}`}</div>
        </Modal>
      )}
      {recordPaymentFor && (
        <Modal title={`Record Payment - ${recordPaymentFor.number || recordPaymentFor.projectName || ''}`} onClose={() => setRecordPaymentFor(null)} onSave={async () => {}}>
          <RecordPaymentForm invoice={recordPaymentFor} onClose={() => setRecordPaymentFor(null)} onSaved={() => setRecordPaymentFor(null)} />
        </Modal>
      )}
      {showFinanceDefaults && (
        <Modal title="Finance Settings" onClose={() => setShowFinanceDefaults(false)} onSave={async () => {
          try {
            if (!currentUser?.uid) return;
            let ratesObj = {};
            try { ratesObj = JSON.parse(fxRatesEditText || '{}'); } catch { ratesObj = {}; }
            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults'), {
              ...financeDefaults,
              fxRates: { base: fxRatesEditBase || (financeDefaults.currency || 'USD'), rates: ratesObj }
            }, { merge: true });
            setFxRates({ base: fxRatesEditBase || (financeDefaults.currency || 'USD'), rates: ratesObj });
            setShowFinanceDefaults(false);
          } catch { setShowFinanceDefaults(false); }
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Default Tax Rate %"><input type="number" step="0.01" value={financeDefaults.taxRate} onChange={(e) => setFinanceDefaults(s => ({ ...s, taxRate: Number(e.target.value||0) }))} /></Field>
            <Field label="Default Discount"><input type="number" step="0.01" value={financeDefaults.discount} onChange={(e) => setFinanceDefaults(s => ({ ...s, discount: Number(e.target.value||0) }))} /></Field>
          </div>
          <Field label="Default Email Recipients (comma separated)"><input value={financeDefaults.recipients} onChange={(e) => setFinanceDefaults(s => ({ ...s, recipients: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Invoice Number Prefix"><input value={financeDefaults.invoiceNumberPrefix} onChange={(e) => setFinanceDefaults(s => ({ ...s, invoiceNumberPrefix: e.target.value }))} /></Field>
            <Field label="Next Invoice Number"><input type="number" value={financeDefaults.nextInvoiceNumber} onChange={(e) => setFinanceDefaults(s => ({ ...s, nextInvoiceNumber: Number(e.target.value||1) }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Payment Provider">
              <select value={financeDefaults.paymentProvider} onChange={(e) => setFinanceDefaults(s => ({ ...s, paymentProvider: e.target.value }))}>
                <option value="paypal">PayPal</option>
                <option value="custom">Custom Link</option>
              </select>
            </Field>
            <Field label="Currency (ISO)"><input value={financeDefaults.currency} onChange={(e) => setFinanceDefaults(s => ({ ...s, currency: e.target.value }))} /></Field>
          </div>
          {financeDefaults.paymentProvider === 'paypal' && (
            <Field label="PayPal Business Email"><input value={financeDefaults.paypalBusinessEmail} onChange={(e) => setFinanceDefaults(s => ({ ...s, paypalBusinessEmail: e.target.value }))} /></Field>
          )}
          {financeDefaults.paymentProvider === 'custom' && (
            <Field label="Custom Payment Base URL"><input placeholder="https://pay.example.com/pay?amount={amount}&ref={number}" value={financeDefaults.customPaymentBaseUrl} onChange={(e) => setFinanceDefaults(s => ({ ...s, customPaymentBaseUrl: e.target.value }))} /></Field>
          )}
          <Field label="Reminder Days (comma separated)"><input value={financeDefaults.reminderDays} onChange={(e) => setFinanceDefaults(s => ({ ...s, reminderDays: e.target.value }))} /></Field>
          <div style={{ fontWeight: 600, marginTop: 8 }}>FX Rates</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Base Currency"><input value={fxRatesEditBase} onChange={(e) => setFxRatesEditBase(e.target.value)} /></Field>
          </div>
          <Field label="Rates JSON">
            <textarea value={fxRatesEditText} onChange={(e) => setFxRatesEditText(e.target.value)} style={{ width: '100%', minHeight: 120, boxSizing: 'border-box' }} />
          </Field>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Example: {`{"EUR":0.93,"GBP":0.80}`}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => { try { const rates = JSON.parse(fxRatesEditText || '{}'); setFxRates({ base: fxRatesEditBase || 'USD', rates }); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Preview Rates</button>
          </div>
        </Modal>
      )}
      {showQuoteTemplates && (
        <Modal title="Quote Templates" onClose={() => setShowQuoteTemplates(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Upload Template</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="file" accept=".html,.htm,.txt,.docx,.pdf" onChange={async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file || !currentUser?.uid) return;
                setTplUploadBusy(true);
                try {
                  const ext = (file.name.split('.').pop() || '').toLowerCase();
                  if (['html','htm','txt'].includes(ext)) {
                    const text = await file.text();
                    await addDoc(collection(db, 'users', currentUser.uid, 'quoteTemplates'), { name: file.name, kind: 'html', content: text, createdAt: serverTimestamp() });
                  } else if (ext === 'docx' || ext === 'pdf') {
                    const path = `quote_templates/${currentUser.uid}/${Date.now()}_${file.name}`;
                    const sref = storageRef(storage, path);
                    await uploadBytes(sref, file);
                    const url = await getDownloadURL(sref);
                    await addDoc(collection(db, 'users', currentUser.uid, 'quoteTemplates'), { name: file.name, kind: ext, storagePath: path, downloadURL: url, createdAt: serverTimestamp() });
                  }
                  e.target.value = '';
                } catch {} finally { setTplUploadBusy(false); }
              }} />
              {tplUploadBusy && <span style={{ fontSize: 12, color: '#6b7280' }}>Uploading…</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => { setShowAiTpl(true); setAiTplText(''); setAiTplError(''); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>AI Generate from Text</button>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Paste sample quote text/HTML; AI will create an HTML template with placeholders.</span>
            </div>
            <div style={{ fontWeight: 600, marginTop: 8 }}>My Templates</div>
            {quoteTemplates.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280' }}>No templates yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quoteTemplates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb', padding: 8, borderRadius: 8 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || 'template'}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => { const sample = quoteRows[0]; if (!sample) return; if ((t.kind||'html') === 'html') renderQuoteWithTemplate(t.content, sample); else window.open(t.downloadURL, '_blank'); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Preview</button>
                      <button onClick={() => validateTemplate(t)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Validate</button>
                      {tplValidation[t.id] && (
                        <span style={{ fontSize: 12, color: tplValidation[t.id].ok ? '#065F46' : '#991B1B' }}>
                          {tplValidation[t.id].checking ? 'Checking…' : (tplValidation[t.id].ok ? 'OK' : 'Issues')}
                        </span>
                      )}
                      <button onClick={async () => { try { await deleteDoc(doc(db, 'users', currentUser.uid, 'quoteTemplates', t.id)); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer', fontSize: 12, color: '#b91c1c' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
      {showRecurring && (
        <Modal title="Recurring Invoices" onClose={() => setShowRecurring(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Create Template</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="Project">
                <select value={newRec.projectId} onChange={(e) => setNewRec(v => ({ ...v, projectId: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                </select>
              </Field>
              <Field label="Client"><input value={newRec.client} onChange={(e) => setNewRec(v => ({ ...v, client: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="Frequency">
                <select value={newRec.frequency} onChange={(e) => setNewRec(v => ({ ...v, frequency: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Start Date"><input type="date" value={newRec.startDate || ''} onChange={(e) => setNewRec(v => ({ ...v, startDate: e.target.value }))} /></Field>
              <Field label="Tax %"><input type="number" step="0.01" value={newRec.taxRate || 0} onChange={(e) => setNewRec(v => ({ ...v, taxRate: Number(e.target.value||0) }))} /></Field>
              <Field label="Discount"><input type="number" step="0.01" value={newRec.discount || 0} onChange={(e) => setNewRec(v => ({ ...v, discount: Number(e.target.value||0) }))} /></Field>
            </div>
            <div>
              <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
                <div>Description</div>
                <div>Qty</div>
                <div>Unit Price</div>
                <div></div>
              </div>
              <div style={{ marginTop: 6 }}>
                {(newRec.items || []).map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
                    <input value={it.description || ''} onChange={(e) => setNewRec(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...v, items }; })} />
                    <input type="number" step="1" value={it.qty ?? ''} onChange={(e) => setNewRec(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], qty: Number(e.target.value||0) }; return { ...v, items }; })} />
                    <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e) => setNewRec(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value||0) }; return { ...v, items }; })} />
                    <button onClick={() => setNewRec(v => { const items = [...(v.items||[])]; items.splice(idx,1); return { ...v, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => setNewRec(v => ({ ...v, items: [...(v.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button disabled={recBusy} onClick={async () => {
                if (!currentUser?.uid || !newRec.projectId || !newRec.client || !newRec.frequency) return;
                setRecBusy(true); setRecError('');
                try {
                  await addDoc(collection(db, 'users', currentUser.uid, 'recurringInvoices'), {
                    ...newRec,
                    createdAt: serverTimestamp()
                  });
                  setNewRec({ projectId: '', client: '', frequency: 'monthly', startDate: '', taxRate: 0, discount: 0, items: [] });
                } catch { setRecError('Failed to save'); } finally { setRecBusy(false); }
              }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>{recBusy ? 'Saving…' : 'Save Template'}</button>
            </div>
            {recError && <div style={{ color: '#991B1B', fontSize: 12 }}>{recError}</div>}
            <div style={{ fontWeight: 600, marginTop: 8 }}>My Templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recTemplates.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6b7280' }}>No templates.</div>
              ) : (
                recTemplates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb', padding: 8, borderRadius: 8 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(projects.find(p=>p.id===t.projectId)?.name)||t.projectId} – {t.client} – {t.frequency}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={async () => { try { await deleteDoc(doc(db, 'users', currentUser.uid, 'recurringInvoices', t.id)); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer', fontSize: 12, color: '#b91c1c' }}>Delete</button>
                      <button onClick={async () => {
                        // Generate one now
                        try {
                          const seq = Number(financeDefaults.nextInvoiceNumber || 1);
                          const prefix = financeDefaults.invoiceNumberPrefix || 'INV-';
                          const number = `${prefix}${String(seq).padStart(4,'0')}`;
                          const items = Array.isArray(t.items) ? t.items : [];
                          const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0);
                          const taxRate = Number(t.taxRate || financeDefaults.taxRate || 0);
                          const taxAmount = subtotal * (taxRate/100);
                          const discount = Number(t.discount || 0);
                          const total = subtotal + taxAmount - discount;
                          await addDoc(collection(db, 'projects', t.projectId, 'invoices'), {
                            number,
                            client: t.client,
                            dueDate: new Date().toISOString().slice(0,10),
                            items,
                            subtotal, taxRate, taxAmount, discount, total,
                            status: 'unpaid',
                            createdAt: serverTimestamp()
                          });
                          if (currentUser?.uid) {
                            await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults'), { nextInvoiceNumber: seq + 1 }, { merge: true });
                          }
                        } catch {}
                      }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Generate Now</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
      {showReminders && (
        <Modal title="Send Payment Reminders" onClose={() => setShowReminders(false)} onSave={async () => {
          try {
            const days = String(financeDefaults.reminderDays || '7,3,1').split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
            const now = new Date();
            const shouldRemind = (due) => {
              if (!due) return false;
              const dueDate = new Date(due);
              const diffDays = Math.ceil((dueDate - now) / (1000*60*60*24));
              return days.includes(diffDays);
            };
            const list = invoiceRows.filter(r => r.status !== 'paid' && shouldRemind(r.dueDate));
            for (const inv of list) {
              await sendInvoiceEmail(inv);
            }
            setShowReminders(false);
          } catch { setShowReminders(false); }
        }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Will send reminders for unpaid invoices whose due date is in the configured number of days: {String(financeDefaults.reminderDays||'7,3,1')}</div>
        </Modal>
      )}
      {showCustomersModal && (
        <Modal title="Customers" onClose={() => { setShowCustomersModal(false); setEditCustomer(null); }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setEditCustomer({ name: '', email: '', phone: '', address: '', currency: financeDefaults.currency || 'USD', taxRate: financeDefaults.taxRate || 0 })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ New Customer</button>
          </div>
          {editCustomer && (
            <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="Name"><input value={editCustomer.name} onChange={(e) => setEditCustomer(c => ({ ...c, name: e.target.value }))} /></Field>
                <Field label="Email"><input value={editCustomer.email} onChange={(e) => setEditCustomer(c => ({ ...c, email: e.target.value }))} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="Phone"><input value={editCustomer.phone} onChange={(e) => setEditCustomer(c => ({ ...c, phone: e.target.value }))} /></Field>
                <Field label="Currency"><input value={editCustomer.currency} onChange={(e) => setEditCustomer(c => ({ ...c, currency: e.target.value }))} /></Field>
                <Field label="Default Tax %"><input type="number" step="0.01" value={editCustomer.taxRate} onChange={(e) => setEditCustomer(c => ({ ...c, taxRate: Number(e.target.value||0) }))} /></Field>
              </div>
              <Field label="Address"><input value={editCustomer.address} onChange={(e) => setEditCustomer(c => ({ ...c, address: e.target.value }))} /></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setEditCustomer(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                <button onClick={async () => {
                  try {
                    if (!currentUser?.uid || !editCustomer?.name) return;
                    const ref = collection(db, 'users', currentUser.uid, 'customers');
                    if (editCustomer.id) {
                      await setDoc(doc(ref, editCustomer.id), editCustomer, { merge: true });
                    } else {
                      await addDoc(ref, { ...editCustomer, createdAt: serverTimestamp() });
                    }
                    setEditCustomer(null);
                  } catch {}
                }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            {customersBook.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280' }}>No customers</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {customersBook.map(c => (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 120px', gap: 8, alignItems: 'center', border: '1px solid #e5e7eb', padding: 8, borderRadius: 8 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name} – {c.email}</div>
                    <div>{c.currency || '-'}</div>
                    <div>{c.phone || '-'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditCustomer(c)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                      <button onClick={async () => { try { await deleteDoc(doc(db, 'users', currentUser.uid, 'customers', c.id)); } catch {} }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer', fontSize: 12, color: '#b91c1c' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
      {showNewInvoice && (
        <Modal title="Create Invoice" onClose={() => setShowNewInvoice(false)} onSave={async () => {
          try {
            if (!newInvoice.projectId || !newInvoice.client) { setShowNewInvoice(false); return; }
            const seq = Number(financeDefaults.nextInvoiceNumber || 1);
            const prefix = financeDefaults.invoiceNumberPrefix || 'INV-';
            const number = `${prefix}${String(seq).padStart(4, '0')}`;
            const items = (newInvoice.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
            const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
            const taxRate = Number(newInvoice.taxRate || financeDefaults.taxRate || 0);
            const taxAmount = subtotal * (taxRate/100);
            const discount = Number(newInvoice.discount || financeDefaults.discount || 0);
            const total = subtotal + taxAmount - discount;
            await addDoc(collection(db, 'projects', newInvoice.projectId, 'invoices'), {
              number,
              client: newInvoice.client,
              dueDate: newInvoice.dueDate || '',
              items,
              subtotal,
              taxRate,
              taxAmount,
              discount,
              total,
              currency: (newInvoice.currency || financeDefaults.currency || 'USD'),
              fxBase: (fxRates.base || financeDefaults.currency || 'USD'),
              fxRate: getFxRate(newInvoice.currency || financeDefaults.currency || 'USD'),
              status: 'unpaid',
              createdAt: serverTimestamp()
            });
            if (currentUser?.uid) {
              await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'financeDefaults'), {
                nextInvoiceNumber: seq + 1
              }, { merge: true });
            }
            setShowNewInvoice(false);
            setNewInvoice({ projectId: '', client: '', dueDate: '', items: [], taxRate: 0, discount: 0, currency: '' });
          } catch { setShowNewInvoice(false); }
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Project">
              <select value={newInvoice.projectId} onChange={(e) => setNewInvoice(v => ({ ...v, projectId: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </Field>
            <Field label="Client">
              <select value={newInvoice.client} onChange={(e) => {
                const name = e.target.value;
                setNewInvoice(v => {
                  const cust = customersBook.find(c => c.name === name);
                  return { ...v, client: name, currency: cust?.currency || v.currency, taxRate: cust?.taxRate ?? v.taxRate };
                });
              }} style={{ width: '100%' }}>
                <option value="">Select or type</option>
                {customersBook.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Currency (ISO)"><input value={newInvoice.currency} onChange={(e) => setNewInvoice(v => ({ ...v, currency: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Due Date"><input type="date" value={newInvoice.dueDate || ''} onChange={(e) => setNewInvoice(v => ({ ...v, dueDate: e.target.value }))} /></Field>
            <Field label="Tax Rate %"><input type="number" step="0.01" value={newInvoice.taxRate ?? financeDefaults.taxRate} onChange={(e) => setNewInvoice(v => ({ ...v, taxRate: Number(e.target.value||0) }))} /></Field>
            <Field label="Discount"><input type="number" step="0.01" value={newInvoice.discount ?? financeDefaults.discount} onChange={(e) => setNewInvoice(v => ({ ...v, discount: Number(e.target.value||0) }))} /></Field>
          </div>
          <div>
            <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
              <div>Description</div>
              <div>Qty</div>
              <div>Unit Price</div>
              <div></div>
            </div>
            <div style={{ marginTop: 6 }}>
              {(newInvoice.items || []).map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
                  <input value={it.description || ''} onChange={(e) => setNewInvoice(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...v, items }; })} />
                  <input type="number" step="1" value={it.qty ?? ''} onChange={(e) => setNewInvoice(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], qty: Number(e.target.value||0) }; return { ...v, items }; })} />
                  <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e) => setNewInvoice(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], unitPrice: Number(e.target.value||0) }; return { ...v, items }; })} />
                  <button onClick={() => setNewInvoice(v => { const items = [...(v.items||[])]; items.splice(idx,1); return { ...v, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setNewInvoice(v => ({ ...v, items: [...(v.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
              {(() => {
                const items = newInvoice.items || [];
                const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
                const taxRateEff = (newInvoice.taxRate ?? financeDefaults.taxRate ?? 0);
                const discountEff = (newInvoice.discount ?? financeDefaults.discount ?? 0);
                const tax = subtotal * (Number(taxRateEff)/100);
                const discount = Number(discountEff);
                const total = subtotal + tax - discount;
                return (
                  <>
                    <div>Subtotal: {subtotal.toFixed(2)}</div>
                    <div>Tax: {tax.toFixed(2)}</div>
                    <div>Discount: {discount.toFixed(2)}</div>
                    <div style={{ fontWeight: 700 }}>Total: {total.toFixed(2)}</div>
                  </>
                );
              })()}
            </div>
          </div>
        </Modal>
      )}
      {showImportInvoices && (
        <Modal title="Import Invoices (CSV)" onClose={() => { setShowImportInvoices(false); setImportInvoicesRows([]); setImportInvoicesError(''); setImportInvoicesPreview([]); }} onSave={async () => {
          const valid = importInvoicesPreview.filter(p => p.errors.length === 0);
          if (!valid.length) { setShowImportInvoices(false); return; }
          setImportInvoicesBusy(true); setImportInvoicesError('');
          try {
            for (const { row, projectId } of valid) {
              const project = projects.find(p => p.id === projectId);
              if (!project) continue;
              const items = Array.isArray(row.items) ? row.items : [];
              const subtotal = items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0);
              const taxRate = Number(row.taxRate || financeDefaults.taxRate || 0);
              const taxAmount = subtotal * (taxRate/100);
              const discount = Number(row.discount || 0);
              const calculated = subtotal + taxAmount - discount;
              const total = Number((row.total ?? calculated ?? 0));
              await addDoc(collection(db, 'projects', project.id, 'invoices'), {
                number: row.number || undefined,
                client: row.client || '',
                dueDate: row.dueDate || '',
                status: row.status || 'unpaid',
                items, subtotal, taxRate, taxAmount, discount, total,
                createdAt: serverTimestamp()
              });
            }
            setShowImportInvoices(false); setImportInvoicesRows([]); setImportInvoicesPreview([]);
          } catch (e) {
            setImportInvoicesError('Failed to import some rows');
          } finally { setImportInvoicesBusy(false); }
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="file" accept=".csv" onChange={async (e) => {
              setImportInvoicesError('');
              try {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                const text = await f.text();
                const rows = parseCsv(text);
                setImportInvoicesRows(rows);
                prepareInvoiceImportPreview(rows);
              } catch { setImportInvoicesError('Failed to parse CSV'); }
            }} />
            {importInvoicesError && <div style={{ color: '#991B1B', fontSize: 12 }}>{importInvoicesError}</div>}
            {importInvoicesBusy && <div style={{ color: '#6b7280', fontSize: 12 }}>Importing…</div>}
            {importInvoicesPreview.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{importInvoicesPreview.length} rows loaded</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                  <div>Client</div>
                  <div>Project</div>
                  <div>Issues</div>
                </div>
                <div>
                  {importInvoicesPreview.map((p, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px', gap: 8, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>{p.row.client || ''}</div>
                      <div>{p.row.project || p.row.projectId || ''}</div>
                      <div style={{ color: p.errors.length ? '#991B1B' : '#065F46' }}>{p.errors.length ? p.errors.join('; ') : 'OK'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#6b7280' }}>Expected columns: project/client/dueDate/status/total. Optional: number,taxRate,discount,items(JSON)</div>
          </div>
        </Modal>
      )}
      {showImportExpenses && (
        <Modal title="Import Expenses (CSV)" onClose={() => { setShowImportExpenses(false); setImportExpensesRows([]); setImportExpensesError(''); setImportExpensesPreview([]); }} onSave={async () => {
          const valid = importExpensesPreview.filter(p => p.errors.length === 0);
          if (!valid.length) { setShowImportExpenses(false); return; }
          setImportExpensesBusy(true); setImportExpensesError('');
          try {
            for (const { row, projectId } of valid) {
              const project = projects.find(p => p.id === projectId);
              if (!project) continue;
              await addDoc(collection(db, 'projects', project.id, 'expenses'), {
                date: row.date || '',
                category: row.category || '',
                amount: Number(row.amount || 0),
                note: row.note || '',
                createdAt: serverTimestamp()
              });
            }
            setShowImportExpenses(false); setImportExpensesRows([]); setImportExpensesPreview([]);
          } catch (e) {
            setImportExpensesError('Failed to import some rows');
          } finally { setImportExpensesBusy(false); }
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="file" accept=".csv" onChange={async (e) => {
              setImportExpensesError('');
              try {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                const text = await f.text();
                const rows = parseCsv(text);
                setImportExpensesRows(rows);
                prepareExpenseImportPreview(rows);
              } catch { setImportExpensesError('Failed to parse CSV'); }
            }} />
            {importExpensesError && <div style={{ color: '#991B1B', fontSize: 12 }}>{importExpensesError}</div>}
            {importExpensesBusy && <div style={{ color: '#6b7280', fontSize: 12 }}>Importing…</div>}
            {importExpensesPreview.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{importExpensesPreview.length} rows loaded</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 200px', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                  <div>Project</div>
                  <div>Date</div>
                  <div>Amount</div>
                  <div>Issues</div>
                </div>
                <div>
                  {importExpensesPreview.map((p, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 200px', gap: 8, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>{p.row.project || p.row.projectId || ''}</div>
                      <div>{p.row.date || ''}</div>
                      <div>{Number(p.row.amount || 0).toFixed(2)}</div>
                      <div style={{ color: p.errors.length ? '#991B1B' : '#065F46' }}>{p.errors.length ? p.errors.join('; ') : 'OK'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#6b7280' }}>Expected columns: project/date/category/amount. Optional: note</div>
          </div>
        </Modal>
      )}
      {applyTplForQuote && (
        <Modal title="Print Quote with Template" onClose={() => { setApplyTplForQuote(null); setSelectedTemplateId(''); }}>
          {quoteTemplates.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>No templates found. Upload one in Templates.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Field label="Template">
                <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  <option value="">Select template</option>
                  {quoteTemplates.map(t => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={async () => {
                  const tpl = quoteTemplates.find(t => t.id === selectedTemplateId);
                  if (!tpl) return;
                  if ((tpl.kind||'html') === 'html') {
                    renderQuoteWithTemplate(tpl.content, applyTplForQuote);
                  } else if (tpl.kind === 'docx') {
                    await fillDocxTemplate(tpl, applyTplForQuote);
                  } else if (tpl.kind === 'pdf') {
                    await fillPdfTemplate(tpl, applyTplForQuote);
                  }
                }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Generate</button>
              </div>
            </div>
          )}
        </Modal>
      )}
      
      {showAiTpl && (
        <Modal title="AI Generate HTML Template" onClose={() => setShowAiTpl(false)} onSave={async () => {
          if (!currentUser?.uid || !aiTplText.trim()) { setShowAiTpl(false); return; }
          setAiTplBusy(true); setAiTplError('');
          try {
            const key = localStorage.getItem('gemini_api_key');
            if (!key) throw new Error('Missing API key');
            const prompt = `Convert the following quote sample into an HTML template that uses these placeholders: {client}, {project}, {validUntil}, {status}, {total}. Include an items table using placeholder {items_table} where we will inject a prebuilt <table>.
Return ONLY raw HTML (no markdown), readable and printable. Keep brand-neutral styling.
Sample:\n\n${aiTplText}`;
            const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + encodeURIComponent(key), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 2000 } })
            });
            const data = await resp.json();
            let html = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!html) throw new Error('AI returned empty result');
            // Strip code fences if present
            html = html.replace(/^```html\s*|```$/g, '').trim();
            await addDoc(collection(db, 'users', currentUser.uid, 'quoteTemplates'), { name: `AI Template ${new Date().toLocaleString()}`, kind: 'html', content: html, createdAt: serverTimestamp() });
            setShowAiTpl(false);
          } catch (e) {
            setAiTplError('Failed to generate: ' + (e?.message || 'Unknown error'));
          } finally { setAiTplBusy(false); }
        }}>
          <Field label="Paste sample (text or HTML)"><textarea value={aiTplText} onChange={(e) => setAiTplText(e.target.value)} style={{ width: '100%', minHeight: 160, boxSizing: 'border-box' }} /></Field>
          {aiTplBusy && <div style={{ fontSize: 12, color: '#6b7280' }}>Generating…</div>}
          {aiTplError && <div style={{ fontSize: 12, color: '#991B1B' }}>{aiTplError}</div>}
          <div style={{ fontSize: 12, color: '#6b7280' }}>Placeholders used: {`{client}`} {`{project}`} {`{validUntil}`} {`{status}`} {`{total}`} and {`{items_table}`}</div>
        </Modal>
      )}
      {statementCustomer && (() => {
        const list = invoiceRows.filter(r => (r.client || 'Unassigned') === statementCustomer);
        const sum = list.reduce((a,b) => a + (b.total || 0), 0);
        const unpaid = list.filter(r => r.status !== 'paid').reduce((a,b) => a + (b.total || 0), 0);
        return (
          <Modal title={`Statement - ${statementCustomer}`} onClose={() => setStatementCustomer(null)}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => exportInvoicesCsv(list)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Export CSV</button>
              <button onClick={() => printStatement(statementCustomer, list)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Print</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 600, marginTop: 8 }}>
              <div>Project</div>
              <div>Due</div>
              <div>Status</div>
              <div>Amount</div>
            </div>
            <div style={{ marginTop: 6 }}>
              {list.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No invoices</div>
              ) : (
                list.map((r, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.projectName}</div>
                    <div>{r.dueDate || '-'}</div>
                    <div>{r.status || 'unpaid'}</div>
                    <div>{Number(r.total||0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
              <div>Total: {sum.toFixed(2)}</div>
              <div>Unpaid: {unpaid.toFixed(2)}</div>
            </div>
          </Modal>
        );
      })()}
      {showInvoiceModal && editInvoice && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => { setShowInvoiceModal(false); setEditInvoice(null); }}
          invoice={editInvoice}
          onSave={async (val) => {
            try {
              const items = (val.items || []).map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
              const subtotal = items.reduce((a, it) => a + (it.qty*it.unitPrice), 0);
              const taxRate = Number(val.taxRate||0);
              const taxAmount = subtotal * (taxRate/100);
              const discount = Number(val.discount||0);
              const total = subtotal + taxAmount - discount;
              await updateDoc(doc(db, 'projects', editInvoice.projectId, 'invoices', editInvoice.id), {
                client: val.client || '',
                dueDate: val.dueDate || '',
                status: val.status || 'unpaid',
                reference: val.reference || '',
                poNumber: val.poNumber || '',
                notes: val.notes || '',
                terms: val.terms || '',
                items, subtotal, taxRate, taxAmount, discount, total
              });
              setShowInvoiceModal(false); setEditInvoice(null);
            } catch { setShowInvoiceModal(false); setEditInvoice(null); }
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{Number(value || 0).toFixed(2)}</div>
    </div>
  );
}

// Quote creation modal (shown when showQuoteModal)
export function QuoteModal({ isOpen, onClose, customers = [], value, onChange, onSave }) {
  if (!isOpen) return null;
  return (
    <Modal title="Create Quote" onClose={onClose} onSave={async () => {
      try {
        if (value.isNewCustomer) {
          const payload = {
            customerProfile: { name: value.newCustomer?.name || '', email: value.newCustomer?.email || '', phone: value.newCustomer?.phone || '' },
            companyProfile: { company: value.newCustomer?.company || '' },
            financeDefaults: { currency: value.currency || 'USD' },
            createdAt: serverTimestamp(),
          };
          const cref = await addDoc(collection(db, 'customerProfiles'), payload);
          await addDoc(collection(db, 'customerProfiles', cref.id, 'quotesDrafts'), {
            client: value.client || payload.customerProfile.name || payload.customerProfile.email || '',
            validUntil: value.validUntil || '',
            items: (value.items||[]).map(it => ({ description: it.description||'', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })),
            total: (value.items||[]).reduce((a,it)=> a + Number(it.qty||0)*Number(it.unitPrice||0), 0),
            status: 'draft',
            createdAt: serverTimestamp()
          });
        } else if (value.customerId) {
          await addDoc(collection(db, 'customerProfiles', value.customerId, 'quotesDrafts'), {
            client: value.client || '',
            validUntil: value.validUntil || '',
            items: (value.items||[]).map(it => ({ description: it.description||'', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })),
            total: (value.items||[]).reduce((a,it)=> a + Number(it.qty||0)*Number(it.unitPrice||0), 0),
            status: 'draft',
            createdAt: serverTimestamp()
          });
        } else {
          alert('Please select a customer or create a new one.');
          return;
        }
        if (onSave) onSave();
        onClose();
      } catch (e) {
        console.error('Failed to save quote', e);
        alert('Failed to save quote');
      }
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Customer">
          <select value={value.customerId || ''} onChange={(e) => onChange(v => {
            const id = e.target.value;
            const cust = customers.find(c => c.id === id);
            // Auto-fill client display and finance defaults
            const next = { ...v, customerId: id, isNewCustomer: false, client: cust ? (cust.name || '') : v.client };
            if (cust) {
              if (cust.currency && !next.currency) next.currency = cust.currency;
              if (typeof cust.taxRate === 'number' && (next.taxRate === undefined || next.taxRate === '')) next.taxRate = cust.taxRate;
            }
            return next;
          })} style={{ width: '100%' }}>
            <option value="">Select customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </select>
        </Field>
        <Field label="New Customer?">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!value.isNewCustomer} onChange={(e) => onChange(v => ({ ...v, isNewCustomer: e.target.checked, customerId: e.target.checked ? '' : v.customerId }))} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>Create new profile</span>
          </label>
        </Field>
        <Field label="Currency (ISO)"><input value={value.currency || ''} onChange={(e) => onChange(v => ({ ...v, currency: e.target.value }))} /></Field>
      </div>
      {value.isNewCustomer && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Customer Name"><input value={value.newCustomer?.name || ''} onChange={(e) => onChange(v => ({ ...v, newCustomer: { ...(v.newCustomer||{}), name: e.target.value } }))} /></Field>
          <Field label="Email"><input type="email" value={value.newCustomer?.email || ''} onChange={(e) => onChange(v => ({ ...v, newCustomer: { ...(v.newCustomer||{}), email: e.target.value } }))} /></Field>
          <Field label="Phone"><input value={value.newCustomer?.phone || ''} onChange={(e) => onChange(v => ({ ...v, newCustomer: { ...(v.newCustomer||{}), phone: e.target.value } }))} /></Field>
          <Field label="Company"><input value={value.newCustomer?.company || ''} onChange={(e) => onChange(v => ({ ...v, newCustomer: { ...(v.newCustomer||{}), company: e.target.value } }))} /></Field>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Client (display)"><input value={value.client} onChange={(e) => onChange(v => ({ ...v, client: e.target.value }))} /></Field>
        <Field label="Valid Until"><input type="date" value={value.validUntil || ''} onChange={(e) => onChange(v => ({ ...v, validUntil: e.target.value }))} /></Field>
        <Field label="Tax Rate %"><input type="number" step="0.01" value={value.taxRate ?? ''} onChange={(e) => onChange(v => ({ ...v, taxRate: e.target.value }))} /></Field>
        <Field label="Discount"><input type="number" step="0.01" value={value.discount ?? ''} onChange={(e) => onChange(v => ({ ...v, discount: e.target.value }))} /></Field>
      </div>
      <div>
        <div style={{ fontWeight: 600, margin: '8px 0' }}>Items</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, fontSize: 12, color: '#6b7280' }}>
          <div>Description</div>
          <div>Qty</div>
          <div>Unit Price</div>
          <div></div>
        </div>
        <div style={{ marginTop: 6 }}>
          {(value.items || []).map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 80px', gap: 8, padding: '4px 0' }}>
              <input value={it.description || ''} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...v, items }; })} />
              <input type="number" step="1" value={it.qty ?? ''} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], qty: e.target.value }; return { ...v, items }; })} />
              <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e) => onChange(v => { const items = [...(v.items||[])]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...v, items }; })} />
              <button onClick={() => onChange(v => { const items = [...(v.items||[])]; items.splice(idx,1); return { ...v, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onChange(v => ({ ...v, items: [...(v.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12 }}>
          {(() => {
            const items = value.items || [];
            const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
            const tax = subtotal * (Number(value.taxRate||0)/100);
            const discount = Number(value.discount||0);
            const total = subtotal + tax - discount;
            return (
              <>
                <div>Subtotal: {subtotal.toFixed(2)}</div>
                <div>Tax: {tax.toFixed(2)}</div>
                <div>Discount: {discount.toFixed(2)}</div>
                <div style={{ fontWeight: 700 }}>Total: {total.toFixed(2)}</div>
              </>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}

function exportInvoicesCsv(rows) {
  try {
    const header = ['client','project','dueDate','status','total'];
    const data = rows.map(r => [r.client || '', r.projectName || '', r.dueDate || '', r.status || 'unpaid', Number(r.total||0).toFixed(2)]);
    downloadCsv([header, ...data], 'invoices.csv');
  } catch {}
}

function exportExpensesCsv(rows) {
  try {
    const header = ['project','date','category','amount','note'];
    const data = rows.map(r => [r.projectName || '', r.date || '', r.category || '', Number(r.amount||0).toFixed(2), (r.note || '').replace(/\n/g,' ')]);
    downloadCsv([header, ...data], 'expenses.csv');
  } catch {}
}

function exportQuotesCsv(rows) {
  try {
    const header = ['client','project','validUntil','status','total'];
    const data = rows.map(r => [r.client || '', r.projectName || '', r.validUntil || '', r.status || 'draft', Number(r.total||0).toFixed(2)]);
    downloadCsv([header, ...data], 'quotes.csv');
  } catch {}
}

function exportCustomersCsv(rows) {
  try {
    const header = ['customer','invoiced','paid','unpaid','count','lastDue'];
    const data = rows.map(r => [r.name, r.invoiced.toFixed(2), r.paid.toFixed(2), r.unpaid.toFixed(2), r.count, r.lastDue || '']);
    downloadCsv([header, ...data], 'customers.csv');
  } catch {}
}

function downloadCsv(matrix, filename) {
  const csv = matrix.map(r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g,'""') + '"' : v).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i+1] === '"') { current += '"'; i++; }
          else { inQuotes = false; }
        } else { current += ch; }
      } else {
        if (ch === ',') { result.push(current); current = ''; }
        else if (ch === '"') { inQuotes = true; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  };
  const header = parseLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] ?? '').trim(); });
    // Parse JSON items if present
    if (obj.items) {
      try {
        const arr = JSON.parse(obj.items);
        if (Array.isArray(arr)) obj.items = arr.map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) }));
      } catch { obj.items = []; }
    }
    // Coerce numerics
    ['total','taxRate','discount','amount'].forEach(k => { if (obj[k] !== undefined) obj[k] = Number(obj[k] || 0); });
    rows.push(obj);
  }
  return rows;
}

function Modal({ title, onClose, children, onSave }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12 }}>Close</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
        {onSave && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={onSave} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: '#6b7280', flex: 1 }}>
      <span style={{ marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function RecordPaymentForm({ invoice, onClose, onSaved }) {
  const [amount, setAmount] = useState(Number(invoice?.total || 0));
  const [date, setDate] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    try {
      if (!invoice?.projectId || !invoice?.id) return;
      setBusy(true);
      await addDoc(collection(db, 'projects', invoice.projectId, 'invoices', invoice.id, 'payments'), {
        amount: Number(amount || 0),
        date: date || new Date().toISOString().slice(0,10),
        method,
        note,
        createdAt: serverTimestamp()
      });
      // Optionally mark paid if fully paid
      const paidTotal = Number(amount || 0);
      if (paidTotal >= Number(invoice.total || 0)) {
        try { await updateDoc(doc(db, 'projects', invoice.projectId, 'invoices', invoice.id), { status: 'paid' }); } catch {}
      }
      onSaved && onSaved();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Amount"><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value||0))} /></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank">Bank Transfer</option>
            <option value="paypal">PayPal</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
        <button disabled={busy} onClick={save} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>{busy ? 'Saving…' : 'Save Payment'}</button>
      </div>
    </div>
  );
}

function InvoiceModal({ isOpen, onClose, invoice, onSave }) {
  const [form, setForm] = useState(() => ({
    client: invoice?.client || '',
    dueDate: invoice?.dueDate || '',
    items: Array.isArray(invoice?.items) ? invoice.items.map(it => ({ description: it.description || '', qty: Number(it.qty||0), unitPrice: Number(it.unitPrice||0) })) : [],
    taxRate: invoice?.taxRate || 0,
    discount: invoice?.discount || 0,
    status: invoice?.status || 'unpaid',
    reference: invoice?.reference || '',
    poNumber: invoice?.poNumber || '',
    notes: invoice?.notes || '',
    terms: invoice?.terms || '',
    currency: invoice?.currency || ''
  }));
  if (!isOpen) return null;
  return (
    <Modal title="Edit Invoice" onClose={onClose} onSave={() => onSave(form)}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Client"><input value={form.client} onChange={(e) => setForm(f => ({ ...f, client: e.target.value }))} /></Field>
        <Field label="Due Date"><input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
        <Field label="Reference"><input value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} /></Field>
        <Field label="Currency (ISO)"><input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="PO Number"><input value={form.poNumber} onChange={(e) => setForm(f => ({ ...f, poNumber: e.target.value }))} /></Field>
        <Field label="Tax Rate %"><input type="number" step="0.01" value={form.taxRate} onChange={(e) => setForm(f => ({ ...f, taxRate: e.target.value }))} /></Field>
        <Field label="Discount"><input type="number" step="0.01" value={form.discount} onChange={(e) => setForm(f => ({ ...f, discount: e.target.value }))} /></Field>
      </div>
      <div>
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
              <input value={it.description || ''} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], description: e.target.value }; return { ...f, items }; })} />
              <input type="number" step="1" value={it.qty ?? ''} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], qty: e.target.value }; return { ...f, items }; })} />
              <input type="number" step="0.01" value={it.unitPrice ?? ''} onChange={(e) => setForm(f => { const items = [...(f.items||[])]; items[idx] = { ...items[idx], unitPrice: e.target.value }; return { ...f, items }; })} />
              <button onClick={() => setForm(f => { const items = [...(f.items||[])]; items.splice(idx,1); return { ...f, items }; })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>Remove</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setForm(f => ({ ...f, items: [...(f.items||[]), { description: '', qty: 1, unitPrice: 0 }] }))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>+ Add Item</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', minHeight: 80, boxSizing: 'border-box' }} /></Field>
          <Field label="Terms"><textarea value={form.terms} onChange={(e) => setForm(f => ({ ...f, terms: e.target.value }))} style={{ width: '100%', minHeight: 80, boxSizing: 'border-box' }} /></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
          {(() => {
            const items = form.items || [];
            const subtotal = items.reduce((a, it) => a + (Number(it.qty||0) * Number(it.unitPrice||0)), 0);
            const tax = subtotal * (Number(form.taxRate||0)/100);
            const discount = Number(form.discount||0);
            const total = subtotal + tax - discount;
            return (
              <>
                <div>Subtotal: {subtotal.toFixed(2)}</div>
                <div>Tax: {tax.toFixed(2)}</div>
                <div>Discount: {discount.toFixed(2)}</div>
                <div style={{ fontWeight: 700 }}>Total: {total.toFixed(2)}</div>
              </>
            );
          })()}
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, margin: '8px 0' }}>Attachments</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="file" accept="image/*,application/pdf" onChange={async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file || !invoice?.projectId || !invoice?.id) return;
            try {
              const path = `invoice_attachments/${invoice.projectId}/${invoice.id}_${Date.now()}_${file.name}`;
              const sref = storageRef(storage, path);
              await uploadBytes(sref, file);
              const url = await getDownloadURL(sref);
              await updateDoc(doc(db, 'projects', invoice.projectId, 'invoices', invoice.id), { attachmentUrl: url, attachmentPath: path });
            } catch {}
          }} />
          {invoice?.attachmentUrl && (
            <a href={invoice.attachmentUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View current</a>
          )}
        </div>
      </div>
    </Modal>
  );
}


