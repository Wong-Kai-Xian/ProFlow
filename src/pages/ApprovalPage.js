import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { DESIGN_SYSTEM, getPageContainerStyle, getContentContainerStyle, getButtonStyle } from '../styles/designSystem';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, getBlob, ref as storageRefFromPath } from 'firebase/storage';
import { PDFDocument } from 'pdf-lib';

// Configure pdf.js worker globally using URL pattern supported by CRA
// eslint-disable-next-line no-unused-vars
let pdfjsLibStatic;
try {
  // Prefer ESM entry; fallback gracefully if not available
  // eslint-disable-next-line global-require
  pdfjsLibStatic = require('pdfjs-dist/build/pdf');
  // eslint-disable-next-line global-require
  const workerSrc = require('pdfjs-dist/build/pdf.worker.js');
  try { pdfjsLibStatic.GlobalWorkerOptions.workerSrc = workerSrc; } catch {}
} catch {}

export default function ApprovalPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Data states
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [currentFilter, setCurrentFilter] = useState('All');
  const [expandedRow, setExpandedRow] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Action modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionComment, setActionComment] = useState('');
  const [actionFiles, setActionFiles] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Delete request states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // eSign modal state
  const [showSignModal, setShowSignModal] = useState(false);
  const [signTarget, setSignTarget] = useState({ fileUrl: '', fileName: '', requestId: '' });
  const signCanvasRef = useRef(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signMode, setSignMode] = useState(false);
  const pdfContainerRef = useRef(null);
  const [pdfjsApi, setPdfjsApi] = useState(null);
  const [pdfDocProxy, setPdfDocProxy] = useState(null);
  const [pageViews, setPageViews] = useState([]); // {pageNum, canvas, overlay, hasInk}
  const [pdfRenderFailed, setPdfRenderFailed] = useState(false);

  const REQUESTS_PER_PAGE = 10;

  // Fetch approval requests
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log('Fetching approval requests for user:', currentUser.uid);

    // Fetch approval requests where user has access (creator, decision maker, or viewer)
    // Maintain latest results per query and rebuild the combined list on any change
    let q1Data = [];
    let q2Data = [];
    let q3Data = [];

    const rebuildCombinedList = () => {
      const map = new Map();
      [...q1Data, ...q2Data, ...q3Data].forEach(request => {
        map.set(request.id, request);
      });
      const requestsArray = Array.from(map.values());
      // Sort by dateRequested descending (most recent first)
      requestsArray.sort((a, b) => {
        if (!a.dateRequested && !b.dateRequested) return 0;
        if (!a.dateRequested) return 1;
        if (!b.dateRequested) return -1;
        return b.dateRequested.getTime() - a.dateRequested.getTime();
      });
      setAllRequests(requestsArray);
      setLoading(false);
      // If we are deleting and the target is now gone, close modal and reset state
      if (deleteLoading && requestToDelete && !requestsArray.find(r => r.id === requestToDelete.id)) {
        setDeleteLoading(false);
        setShowDeleteModal(false);
        setRequestToDelete(null);
      }
      console.log('Processed approval requests (combined):', requestsArray);
    };

    // Query 1: Requests created by user
    const q1 = query(
      collection(db, 'approvalRequests'),
      where('requestedBy', '==', currentUser.uid)
    );

    // Query 2: Requests where user is decision maker
    const q2 = query(
      collection(db, 'approvalRequests'),
      where('requestedTo', '==', currentUser.uid)
    );

    // Query 3: Requests where user is a viewer
    const q3 = query(
      collection(db, 'approvalRequests'),
      where('viewers', 'array-contains', currentUser.uid)
    );

    const normalizeDateValue = (val, timeVal) => {
      try {
        if (val && typeof val.toDate === 'function') {
          return val.toDate();
        }
        if (typeof val === 'string' && val) {
          const time = (typeof timeVal === 'string' && timeVal.trim()) ? timeVal : '00:00';
          const d = new Date(`${val}T${time}`);
          return isNaN(d) ? null : d;
        }
        if (typeof val === 'number') {
          const d = new Date(val);
          return isNaN(d) ? null : d;
        }
      } catch {}
      return null;
    };

    const unsubscribe1 = onSnapshot(q1, (snapshot) => {
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateRequested: normalizeDateValue(data.dateRequested),
          decisionDate: normalizeDateValue(data.decisionDate),
          dueDate: normalizeDateValue(data.dueDate, data.dueTime)
        };
      });
      q1Data = requests;
      rebuildCombinedList();
    });

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateRequested: normalizeDateValue(data.dateRequested),
          decisionDate: normalizeDateValue(data.decisionDate),
          dueDate: normalizeDateValue(data.dueDate, data.dueTime)
        };
      });
      q2Data = requests;
      rebuildCombinedList();
    });

    const unsubscribe3 = onSnapshot(q3, (snapshot) => {
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateRequested: normalizeDateValue(data.dateRequested),
          decisionDate: normalizeDateValue(data.decisionDate),
          dueDate: normalizeDateValue(data.dueDate, data.dueTime)
        };
      });
      q3Data = requests;
      rebuildCombinedList();
    });

    return () => {
      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    };
  }, [currentUser]);

  // Filter and search requests
  useEffect(() => {
    let filtered = allRequests;

    // Apply filter
    if (currentFilter !== 'All') {
      filtered = filtered.filter(request => {
        const status = request.status?.toLowerCase();
        return status === currentFilter.toLowerCase();
      });
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        request.requestTitle?.toLowerCase().includes(term) ||
        request.entityName?.toLowerCase().includes(term) ||
        request.requestedByName?.toLowerCase().includes(term)
      );
    }

    setFilteredRequests(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allRequests, currentFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE);
  const startIndex = (currentPage - 1) * REQUESTS_PER_PAGE;
  const currentRequests = filteredRequests.slice(startIndex, startIndex + REQUESTS_PER_PAGE);

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { 
        color: DESIGN_SYSTEM.colors.warning, 
        bg: `${DESIGN_SYSTEM.colors.warning}20`,
        text: 'Pending'
      },
      approved: { 
        color: DESIGN_SYSTEM.colors.success, 
        bg: `${DESIGN_SYSTEM.colors.success}20`,
        text: 'Approved'
      },
      rejected: { 
        color: DESIGN_SYSTEM.colors.error, 
        bg: `${DESIGN_SYSTEM.colors.error}20`,
        text: 'Rejected'
      }
    };
    
    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    
    return (
      <span style={{
        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
        borderRadius: DESIGN_SYSTEM.borderRadius.base,
        fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
        fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.color}30`
      }}>
        {config.text}
      </span>
    );
  };

  const getRequestTypeBadge = (type) => {
    const isProject = type === 'Project';
    return (
      <span style={{
        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
        borderRadius: DESIGN_SYSTEM.borderRadius.base,
        fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
        fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
        color: DESIGN_SYSTEM.colors.text.inverse,
        backgroundColor: isProject 
          ? DESIGN_SYSTEM.pageThemes.projects.accent
          : DESIGN_SYSTEM.pageThemes.customers.accent
      }}>
        {type}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const handleRowClick = (requestId) => {
    setExpandedRow(expandedRow === requestId ? null : requestId);
  };

  const handleEntityClick = (request, e) => {
    e.stopPropagation();
    if (request.projectId) {
      navigate(`/project/${request.projectId}`);
    } else if (request.customerId) {
      navigate(`/customer/${request.customerId}`);
    }
  };

  const openActionModal = (request, action, e) => {
    e.stopPropagation();
    setSelectedRequest(request);
    setActionType(action);
    setActionComment('');
    setActionFiles([]);
    setShowActionModal(true);
  };

  const openDeleteModal = (request, e) => {
    e.stopPropagation();
    setRequestToDelete(request);
    setShowDeleteModal(true);
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'approvalRequests', requestToDelete.id));
      // Close immediately; list will live-update from onSnapshot
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error("Error deleting approval request:", error);
      alert("Failed to delete approval request. Please try again.");
      setDeleteLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setActionFiles(prev => [...prev, ...files]);
  };

  const removeActionFile = (index) => {
    setActionFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadFile = async (fileUrl, fileName) => {
    if (!fileUrl) {
      alert("File URL is not available");
      return;
    }

    try {
      console.log('Attempting to download file:', fileUrl, fileName);
      
      // Try direct link first (for Firebase Storage URLs)
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName || 'attachment';
      a.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (error) {
      console.error("Error downloading file:", error);
      
      // Fallback: open in new tab
      try {
        window.open(fileUrl, '_blank');
      } catch (fallbackError) {
        console.error("Fallback failed:", fallbackError);
        alert("Failed to download or open file. Please check the file URL.");
      }
    }
  };

  const generatePdfFromQuote = async (quoteData) => {
    try {
      const data = quoteData || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const currency = (data.currency || 'USD').toUpperCase();
      const baseCurrency = (data.fxBase || currency || 'USD').toUpperCase();
      const rate = (baseCurrency === currency) ? 1 : Number(data.fxRate || 1);
      const fmt = (n) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n||0)); } catch { return `${currency} ${Number(n||0).toFixed(2)}`; } };
      const unitToDisplay = (unit) => (baseCurrency === currency) ? Number(unit||0) : Number(unit||0) * (rate || 1);
      const rows = items.map((it, i) => `
        <tr>
          <td>${it.description || `Item ${i+1}`}</td>
          <td class="num">${Number(it.qty||1)}</td>
          <td class="num">${fmt(unitToDisplay(it.unitPrice))}</td>
          <td class="num">${fmt(Number(it.qty||1)*unitToDisplay(it.unitPrice))}</td>
        </tr>`).join('');
      const subtotal = (typeof data.subtotal === 'number') ? Number(data.subtotal||0) : items.reduce((s,it)=> s + Number(it.qty||1)*unitToDisplay(it.unitPrice),0);
      const taxRate = Number(data.taxRate || 0);
      const discount = (typeof data.discount === 'number') ? Number(data.discount || 0) : 0;
      const taxAmount = (typeof data.taxAmount === 'number') ? Number(data.taxAmount || 0) : subtotal * (taxRate/100);
      const total = (typeof data.total === 'number') ? Number(data.total || 0) : (subtotal + taxAmount - discount);
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      const logoUrl = '/proflow-logo.png';
      const html = `
        <html>
        <head>
          <meta charset="utf-8"/>
          <title>${data.name || 'Quotation'}</title>
          <style>
            *{box-sizing:border-box}
            body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;padding:24px;background:#f9fafb}
            .sheet{width:820px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px}
            .header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px}
            .brand{display:flex;gap:12px;align-items:center}
            .brand img{height:36px;width:auto}
            .brand h1{font-size:20px;margin:0}
            .meta{font-size:12px;color:#6b7280;text-align:right}
            h2{font-size:18px;margin:12px 0}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
            .card{border:1px solid #e5e7eb;border-radius:8px;padding:12px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            thead th{background:#f3f4f6;border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}
            tbody td{border:1px solid #e5e7eb;padding:8px;font-size:12px}
            td.num{text-align:right}
            .totals{margin-top:12px;display:flex;justify-content:flex-end}
            .totals-box{min-width:240px;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#f9fafb}
            .row{display:flex;justify-content:space-between;margin:4px 0}
            .row.total{font-weight:600}
            .footer{margin-top:16px;font-size:12px;color:#6b7280;text-align:center}
            @media print{body{background:#fff} .sheet{border:none}}
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="brand">
                <img src="${logoUrl}" alt="Logo"/>
                <h1>${data.name || 'Quotation'}</h1>
              </div>
              <div class="meta">
                <div>Date: ${dateStr}</div>
                ${data.validUntil ? `<div>Valid Until: ${data.validUntil}</div>` : ''}
              </div>
            </div>
            <div class="grid">
              <div class="card">
                <div style="font-weight:600;margin-bottom:6px">Customer</div>
                <div>${data.client || ''}</div>
              </div>
              <div class="card">
                <div style="font-weight:600;margin-bottom:6px">Reference</div>
                <div>${data.reference || ''}</div>
              </div>
            </div>
            <h2>Items</h2>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="num">Qty</th>
                  <th class="num">Unit</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="totals">
              <div class="totals-box">
                <div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
                <div class="row"><span>Tax (${taxRate.toFixed(2)}%)</span><span>${fmt(taxAmount)}</span></div>
                <div class="row"><span>Discount</span><span>${fmt(discount)}</span></div>
                <div class="row total"><span>Total</span><span>${fmt(total)}</span></div>
              </div>
            </div>
            <div class="footer">Generated by ProFlow</div>
          </div>
          <script>window.print && window.print()</script>
        </body>
        </html>`;
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); } else { alert('Pop-up blocked. Allow pop-ups to view.'); }
    } catch (err) {
      console.error('Failed to show quotation preview', err);
      alert('Unable to preview quotation');
    }
  };

  // eSign helpers
  const openSignModal = (requestId, fileUrl, fileName, fileBytesOrBlob) => {
    const next = { requestId, fileUrl, fileName, fileBytes: null, fileBlob: null };
    try {
      if (fileBytesOrBlob) {
        if (typeof fileBytesOrBlob === 'object' && typeof fileBytesOrBlob.arrayBuffer === 'function') {
          next.fileBlob = fileBytesOrBlob; // File/Blob
        } else {
          next.fileBytes = fileBytesOrBlob; // ArrayBuffer
        }
      }
    } catch {}
    setSignTarget(next);
    setShowSignModal(true);
    setSignMode(true);
    setTimeout(() => { try { initPdfJs(fileUrl); } catch {} try { initCanvas(); } catch {} }, 0);
  };

  // Initialize PDF.js and render pages
  const initPdfJs = async (urlOverride) => {
    try {
      const url = urlOverride || signTarget.fileUrl;
      if (!url) return;
      setPdfRenderFailed(false);
      // Configure worker to local file in public to avoid CDN/module issues
      try {
        if (pdfjsLibStatic && pdfjsLibStatic.GlobalWorkerOptions) {
          pdfjsLibStatic.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        }
      } catch {}
      const pdfjsLib = pdfjsLibStatic || (await import('pdfjs-dist/build/pdf'));
      setPdfjsApi(pdfjsLib);
      // Resolve bytes via provided blob/bytes, or Firebase Storage, or fetch as fallback
      const resolveBytes = async () => {
        try {
          // Prefer blob (local upload) for fresh buffer each time
          if (signTarget && signTarget.fileBlob && typeof signTarget.fileBlob.arrayBuffer === 'function') {
            return await signTarget.fileBlob.arrayBuffer();
          }
          // If bytes provided (loose eSign), clone if possible
          if (signTarget && signTarget.fileBytes && typeof signTarget.fileBytes.byteLength === 'number' && signTarget.fileBytes.byteLength > 0) {
            try { return signTarget.fileBytes.slice(0); } catch { return signTarget.fileBytes; }
          }
          // 1) Try using the SDK with the full download URL
          try {
            const directRef = ref(storage, url);
            const blob = await getBlob(directRef);
            return await blob.arrayBuffer();
          } catch {}
          // 2) Convert googleapis URL to gs://<bucket>/<object> and retry
          try {
            const m = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
            if (m && m[1] && m[2]) {
              let bucket = m[1];
              const objectPath = decodeURIComponent(m[2]);
              if (bucket.endsWith('.firebasestorage.app')) {
                bucket = bucket.replace(/\.firebasestorage\.app$/, '.appspot.com');
              }
              const gsUrl = `gs://${bucket}/${objectPath}`;
              const gsRef = ref(storage, gsUrl);
              const blob = await getBlob(gsRef);
              return await blob.arrayBuffer();
            }
          } catch {}
          // 3) If this is a blob: URL, fetch it
          try {
            if ((url || '').startsWith('blob:')) {
              const resp = await fetch(url);
              if (resp.ok) return await resp.arrayBuffer();
            }
          } catch {}
          // Give up (show fallback link)
          return null;
        } catch { return null; }
      };

      let bytes = await resolveBytes();
      let pdf;
      if (bytes) {
        const loadingTaskA = pdfjsLib.getDocument({ data: bytes, disableWorker: true });
        pdf = await loadingTaskA.promise;
      } else {
        // If we could not obtain bytes (likely due to CORS), show fallback UI
        throw new Error('Unable to load PDF bytes (CORS).');
      }
      setPdfDocProxy(pdf);
      await renderAllPages(pdf);
    } catch (err) {
      console.error('PDF.js init failed, falling back to iframe/object', err);
      setPdfRenderFailed(true);
      // Fallback: keep old canvas init so at least signing works in overlay
      initCanvas();
    }
  };

  const refreshPdfLayout = async () => {
    try {
      setPdfRenderFailed(false);
      if (pdfDocProxy) {
        await renderAllPages(pdfDocProxy);
      } else if (signTarget?.fileUrl) {
        await initPdfJs(signTarget.fileUrl);
      }
    } catch (e) {
      console.error('Refresh PDF failed', e);
    }
  };

  const renderAllPages = async (pdf) => {
    try {
      const container = pdfContainerRef.current;
      if (!container) return;
      container.innerHTML = '';
      const newViews = [];
      const containerWidth = container.clientWidth || 800;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const unscaled = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaled.width;
        const viewport = page.getViewport({ scale });
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.marginBottom = '12px';
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;
        wrapper.style.maxWidth = '100%';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        wrapper.appendChild(canvas);
        const overlay = document.createElement('canvas');
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = `${viewport.width}px`;
        overlay.style.height = `${viewport.height}px`;
        overlay.style.cursor = signMode ? 'crosshair' : 'default';
        overlay.style.pointerEvents = signMode ? 'auto' : 'none';
        overlay.style.touchAction = 'none';
        wrapper.appendChild(overlay);
        container.appendChild(wrapper);
        try {
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (e) {
          console.error('Page render failed', e);
        }
        const view = { pageNum: i, canvas, overlay, hasInk: false };
        wireOverlay(view);
        newViews.push(view);
      }
      setPageViews(newViews);
    } catch (e) {
      console.error('Render pages failed', e);
    }
  };

  const wireOverlay = (view) => {
    try {
      const overlay = view.overlay;
      const ctx = overlay.getContext('2d');
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111827';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let drawing = false;
      const getPos = (e) => {
        const rect = overlay.getBoundingClientRect();
        const clientX = (e.touches ? e.touches[0].clientX : (e.clientX ?? 0));
        const clientY = (e.touches ? e.touches[0].clientY : (e.clientY ?? 0));
        return { x: clientX - rect.left, y: clientY - rect.top };
      };
      const start = (e) => { if (!signMode) return; drawing = true; setIsSigning(true); view.hasInk = true; const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
      const move = (e) => { if (!signMode || !drawing) return; const { x, y } = getPos(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); };
      const end = () => { drawing = false; };
      overlay.onpointerdown = start;
      overlay.onpointermove = move;
      overlay.onpointerup = end;
      overlay.onpointercancel = end;
    } catch {}
  };

  // When toggling sign mode, update overlays pointer events
  useEffect(() => {
    try {
      pageViews.forEach(v => {
        if (v.overlay) {
          v.overlay.style.pointerEvents = 'auto';
          v.overlay.style.cursor = 'crosshair';
        }
      });
    } catch {}
  }, [pageViews]);

  const initCanvas = () => {
    try {
      const canvas = signCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      // Transparent background overlay
      const setSize = () => {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 480;
        canvas.width = Math.max(1, Math.floor(w));
        canvas.height = Math.max(1, Math.floor(h));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
      };
      setSize();
      try { window.removeEventListener('resize', setSize); } catch {}
      window.addEventListener('resize', setSize);
      canvas.style.touchAction = 'none';
      let drawing = false;
      const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = (e.touches ? e.touches[0].clientX : (e.clientX ?? 0));
        const clientY = (e.touches ? e.touches[0].clientY : (e.clientY ?? 0));
        return { x: clientX - rect.left, y: clientY - rect.top };
      };
      const start = (e) => { drawing = true; setIsSigning(true); try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch {} const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y); };
      const move = (e) => { if (!drawing) return; const { x, y } = getPos(e); ctx.lineTo(x, y); ctx.stroke(); };
      const end = (e) => { drawing = false; try { canvas.releasePointerCapture && canvas.releasePointerCapture(e?.pointerId); } catch {} };
      canvas.onpointerdown = start;
      canvas.onpointermove = move;
      canvas.onpointerup = end;
      canvas.onpointercancel = end;
    } catch {}
  };

  const clearSignature = () => {
    if (pageViews && pageViews.length) {
      pageViews.forEach(v => {
        try { v.overlay?.getContext('2d')?.clearRect(0, 0, v.overlay.width, v.overlay.height); } catch {}
        v.hasInk = false;
      });
      setIsSigning(false);
      return;
    }
    // Fallback for old single overlay
    const canvas = signCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSigning(false);
  };

  const applySignature = async () => {
    try {
      // Load original PDF bytes via provided blob/bytes, or Storage, or fetch
      const loadBytes = async () => {
        try {
          if (signTarget && signTarget.fileBlob && typeof signTarget.fileBlob.arrayBuffer === 'function') {
            return await signTarget.fileBlob.arrayBuffer();
          }
        } catch {}
        try {
          if (signTarget && signTarget.fileBytes && typeof signTarget.fileBytes.byteLength === 'number' && signTarget.fileBytes.byteLength > 0) {
            try { return signTarget.fileBytes.slice(0); } catch { return signTarget.fileBytes; }
          }
        } catch {}
        try {
          const directRef = ref(storage, signTarget.fileUrl);
          const blob = await getBlob(directRef);
          return await blob.arrayBuffer();
        } catch {}
        try {
          const m = (signTarget.fileUrl || '').match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
          if (m && m[1] && m[2]) {
            const bucket = m[1];
            const objectPath = decodeURIComponent(m[2]);
            const gsUrl = `gs://${bucket}/${objectPath}`;
            const gsRef = ref(storage, gsUrl);
            const blob = await getBlob(gsRef);
            return await blob.arrayBuffer();
          }
        } catch {}
        // As a last resort, try network fetch (CORS should be set now)
        try {
          let url = signTarget.fileUrl || '';
          if (url.includes('firebasestorage.googleapis.com') && !/alt=media/.test(url)) {
            url += (url.includes('?') ? '&' : '?') + 'alt=media';
          }
          // If object URL (blob:), fetch normally
          if ((url || '').startsWith('blob:')) {
            const resp = await fetch(url, { method: 'GET', credentials: 'omit' });
            if (resp.ok) return await resp.arrayBuffer();
          }
          const resp = await fetch(url, { method: 'GET', credentials: 'omit' });
          if (resp.ok) {
            return await resp.arrayBuffer();
          }
        } catch {}
        throw new Error('Unable to load original PDF bytes');
      };
      const arrayBuf = await loadBytes();
      const pdfDoc = await PDFDocument.load(arrayBuf);
      // If we have per-page overlays, composite them page by page
      if (pageViews && pageViews.length) {
        const pages = pdfDoc.getPages();
        let anyInk = false;
        for (let i = 0; i < Math.min(pages.length, pageViews.length); i++) {
          const v = pageViews[i];
          const overlay = v.overlay;
          if (!overlay) continue;
          // Skip empty overlays
          if (!v.hasInk) continue;
          anyInk = true;
          const pngBlob = await new Promise((resolve) => overlay.toBlob(resolve, 'image/png'));
          if (!pngBlob) continue;
          const pngBytes = await pngBlob.arrayBuffer();
          const pngImage = await pdfDoc.embedPng(pngBytes);
          const page = pages[i];
          const { width, height } = page.getSize();
          // Overlay canvas is rendered at same pixel dimensions as page viewport scale; fit to full page
          page.drawImage(pngImage, { x: 0, y: 0, width, height, opacity: 0.98 });
        }
        if (!anyInk) {
          alert('No signature drawn. Please sign before applying.');
          return;
        }
      } else {
        // Fallback to single overlay behavior (place at bottom-right)
        const canvas = signCanvasRef.current; if (!canvas) return;
        const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!pngBlob) throw new Error('Unable to capture signature image');
        const pngBytes = await pngBlob.arrayBuffer();
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const pages = pdfDoc.getPages();
        const page = pages[pages.length - 1];
        const { width } = page.getSize();
        const sigWidth = Math.min(300, width * 0.5);
        const sigHeight = (pngImage.height / pngImage.width) * sigWidth;
        const margin = 36;
        page.drawImage(pngImage, { x: width - sigWidth - margin, y: margin, width: sigWidth, height: sigHeight, opacity: 0.95 });
      }
      const signedBytes = await pdfDoc.save();
      const blob = new Blob([signedBytes], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (signTarget.fileName?.replace(/\.pdf$/i, '') || 'document') + '-signed.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setShowSignModal(false);
      setSignTarget({ fileUrl: '', fileName: '', requestId: '', fileBytes: null, fileBlob: null });
      setIsSigning(false);
    } catch (e) {
      console.error('Failed to sign PDF', e);
      alert('Failed to sign PDF: ' + (e && e.message ? e.message : 'Unknown error'));
    }
  };

  const processAction = async () => {
    if (!selectedRequest || !actionType) return;

    setActionLoading(true);

    try {
      // Upload action files if any
      let actionFileUrls = [];
      let actionFileNames = [];

      for (const file of actionFiles) {
        const storageRef = ref(storage, `approval_actions/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            null,
            reject,
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              actionFileUrls.push(downloadURL);
              actionFileNames.push(file.name);
              resolve();
            }
          );
        });
      }

      // Update the approval request
      const requestRef = doc(db, 'approvalRequests', selectedRequest.id);
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        decisionMade: true,
        decisionBy: currentUser.uid,
        decisionByName: currentUser.name || currentUser.displayName || currentUser.email,
        decisionDate: serverTimestamp(),
        decisionComment: actionComment.trim(),
        decisionFiles: actionFileUrls,
        decisionFileNames: actionFileNames,
        updatedAt: serverTimestamp()
      };

      await updateDoc(requestRef, updateData);

      // If approved and this is a customer conversion request, create the project and link to customer
      if (actionType === 'approve' && selectedRequest.requestType === 'Customer' && selectedRequest.proposedProject && selectedRequest.customerId) {
        try {
          // Create project from proposedProject
          const projectPayload = {
            name: selectedRequest.proposedProject.name || 'New Project',
            description: selectedRequest.proposedProject.description || '',
            deadline: selectedRequest.proposedProject.deadline || null,
            company: selectedRequest.proposedProject.company || '',
            contactPerson: selectedRequest.proposedProject.customerName || '',
            contactEmail: selectedRequest.proposedProject.customerEmail || '',
            status: 'Active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            customerId: selectedRequest.customerId,
            convertedFromCustomer: true,
            userId: selectedRequest.requestedBy,
            createdBy: selectedRequest.requestedBy,
            createdByName: selectedRequest.requestedByName || '' ,
            team: [selectedRequest.requestedBy]
          };
          const projRef = await addDoc(collection(db, 'projects'), projectPayload);
          // Freeze current no-project lead score into project and reset customer no-project score
          try {
            const custSnap = await getDoc(doc(db, 'customerProfiles', selectedRequest.customerId));
            const custData = custSnap.exists() ? (custSnap.data() || {}) : {};
            const frozen = custData.leadScores?.noProject || null;
            if (frozen) {
              await updateDoc(doc(db, 'projects', projRef.id), { leadScore: frozen });
            } else {
              await updateDoc(doc(db, 'projects', projRef.id), { leadScore: null });
            }
            // Reset 'No Project' score and set reset marker
            await updateDoc(doc(db, 'customerProfiles', selectedRequest.customerId), { leadScores: { noProject: null, noProjectResetAt: Date.now() } });
          } catch {}
          // Link project to customer profile for dropdown and snapshot stages if present
          try {
            const custSnap = await getDoc(doc(db, 'customerProfiles', selectedRequest.customerId));
            const custData = custSnap.exists() ? custSnap.data() : {};
            const stages = custData.stages || ['Working','Qualified','Converted'];
            // Reset stage tasks/notes for No Project after conversion per request
            const cleanedStageData = Object.fromEntries((stages || []).map(s => [s, { notes: [], tasks: [], completed: false }]));
            const currentStage = stages[0];
            const snapshot = { stages, stageData: (custData.stageData || cleanedStageData), currentStage: (custData.currentStage || stages[0]), reminders: custData.reminders || [], files: custData.files || [], activities: custData.activities || [] };
            await updateDoc(doc(db, 'customerProfiles', selectedRequest.customerId), {
              projects: arrayUnion(projRef.id),
              projectSnapshots: { ...(custData.projectSnapshots || {}), [projRef.id]: snapshot },
              // and clear after snapshot
              stageData: cleanedStageData,
              currentStage,
              activities: [],
              reminders: [],
              files: []
            });
          } catch {
            await updateDoc(doc(db, 'customerProfiles', selectedRequest.customerId), {
              projects: arrayUnion(projRef.id)
            });
          }

          // Optional quotation migration: migrate only the explicitly selected draft; else delete all drafts
          try {
            const draftsSnap = await getDocs(collection(db, 'customerProfiles', selectedRequest.customerId, 'quotesDrafts'));
            const ops = [];
            const selectedDraftId = selectedRequest?.selectedDraftQuoteId || null;
            // If selectedDraftId provided, migrate only that one; otherwise delete all
            draftsSnap.forEach(d => {
              const q = d.data() || {};
              if (q.projectId) return;
              if (selectedDraftId && d.id === selectedDraftId) {
                const items = Array.isArray(q.items) ? q.items : [];
                const draftSubtotal = Number(q.subtotal || items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unitPrice||0)), 0));
                const taxRate = Number(q.taxRate || 0);
                const discount = Number(q.discount || 0);
                const taxAmount = Number(q.taxAmount || (draftSubtotal * (taxRate/100)));
                const total = Number(q.total || (draftSubtotal + taxAmount - discount));
                ops.push(addDoc(collection(db, 'projects', projRef.id, 'quotes'), {
                  client: q.client || '',
                  validUntil: q.validUntil || '',
                  items,
                  subtotal: draftSubtotal,
                  taxRate,
                  discount,
                  taxAmount,
                  total,
                  currency: q.currency || undefined,
                  fxBase: q.fxBase || undefined,
                  fxRate: q.fxRate || undefined,
                  status: q.status || 'draft',
                  createdAt: serverTimestamp(),
                  movedFromCustomerId: selectedRequest.customerId,
                }).catch(() => {}));
                ops.push(updateDoc(doc(db, 'customerProfiles', selectedRequest.customerId, 'quotesDrafts', d.id), { projectId: projRef.id }).catch(() => {}));
              } else {
                ops.push(deleteDoc(doc(db, 'customerProfiles', selectedRequest.customerId, 'quotesDrafts', d.id)).catch(() => {}));
              }
            });
            if (ops.length > 0) await Promise.all(ops);
            // Safety: ensure at most one quote under project if selection existed
            if (selectedDraftId) {
              try {
                const projQuotesSnap = await getDocs(collection(db, 'projects', projRef.id, 'quotes'));
                let kept = false;
                const removals = [];
                projQuotesSnap.forEach(qdoc => {
                  if (!kept) { kept = true; return; }
                  removals.push(deleteDoc(doc(db, 'projects', projRef.id, 'quotes', qdoc.id)).catch(() => {}));
                });
                if (removals.length > 0) await Promise.all(removals);
              } catch {}
            }
          } catch {}

          // Move customer transcripts to the new project's transcripts collection
          try {
            const transSnap = await getDocs(collection(db, 'customerProfiles', selectedRequest.customerId, 'meetingTranscripts'));
            const moves = [];
            transSnap.forEach(tdoc => {
              const t = tdoc.data() || {};
              moves.push(
                addDoc(collection(db, 'projects', projRef.id, 'meetingTranscripts'), {
                  ...t,
                  migratedFromCustomerId: selectedRequest.customerId,
                  migratedAt: serverTimestamp()
                })
                  .then(() => deleteDoc(doc(db, 'customerProfiles', selectedRequest.customerId, 'meetingTranscripts', tdoc.id)))
                  .catch(() => {})
              );
            });
            if (moves.length > 0) await Promise.all(moves);
          } catch {}

          // Move attached files to the project for history
          try {
            const custSnap2 = await getDoc(doc(db, 'customerProfiles', selectedRequest.customerId));
            const files = (custSnap2.exists() ? (custSnap2.data().files || []) : []);
            if (files && files.length > 0) {
              await updateDoc(doc(db, 'projects', projRef.id), { files });
            }
          } catch {}
        } catch (e) {
          console.error('Failed to create/link project after approval', e);
        }
      }

      // Notifications to stakeholders
      try {
        // Notify requester
        await addDoc(collection(db, 'users', selectedRequest.requestedBy, 'notifications'), {
          unread: true,
          createdAt: serverTimestamp(),
          origin: 'approval',
          title: `Approval ${actionType === 'approve' ? 'approved' : 'rejected'}`,
          message: `${selectedRequest.requestTitle || selectedRequest.projectName || 'Request'} was ${actionType === 'approve' ? 'approved' : 'rejected'} by ${currentUser.name || currentUser.displayName || currentUser.email}`,
          refType: 'approval',
          approvalId: selectedRequest.id,
          projectId: selectedRequest.projectId || null,
          customerId: selectedRequest.customerId || null
        });
        // Notify viewers
        const viewerIds = selectedRequest.viewers || [];
        for (const vid of viewerIds) {
          try {
            await addDoc(collection(db, 'users', vid, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'approval',
              title: 'Approval decision',
              message: `${selectedRequest.requestTitle || selectedRequest.projectName || 'Request'} was ${actionType === 'approve' ? 'approved' : 'rejected'}`,
              refType: 'approval',
              approvalId: selectedRequest.id,
              projectId: selectedRequest.projectId || null,
              customerId: selectedRequest.customerId || null
            });
          } catch {}
        }
      } catch {}

      // If approved and it's a project stage advancement, update the project
      if (actionType === 'approve' && selectedRequest.projectId && selectedRequest.nextStage) {
        const projectRef = doc(db, 'projects', selectedRequest.projectId);
        const projectDoc = await getDoc(projectRef);
        
        if (projectDoc.exists()) {
          await updateDoc(projectRef, {
            stage: selectedRequest.nextStage,
            updatedAt: serverTimestamp()
          });
        }
      }

      // If approving a customer-to-project conversion request, remove pending approval status
      if (actionType === 'approve' && selectedRequest.requestType === 'Customer' && 
          (selectedRequest.requestTitle?.includes('Convert') || selectedRequest.requestTitle?.toLowerCase().includes('convert'))) {
        // Find the project associated with this customer
        const projectsQuery = query(
          collection(db, 'projects'),
          where('customerId', '==', selectedRequest.entityId),
          where('convertedFromCustomer', '==', true),
          where('pendingApproval', '==', true)
        );
        
        try {
          const projectsSnapshot = await getDocs(projectsQuery);
          if (!projectsSnapshot.empty) {
            const projectDoc = projectsSnapshot.docs[0];
            await updateDoc(doc(db, 'projects', projectDoc.id), {
              pendingApproval: false,
              approvalRequestSent: false,
              status: "Active"
            });
          }
        } catch (error) {
          console.error("Error updating project approval status:", error);
        }
      }

      // Create notification for the requester
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRequest.requestedBy,
        type: 'approval_decision',
        title: `Request ${actionType === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Your request "${selectedRequest.requestTitle}" has been ${actionType}d by ${currentUser.name || currentUser.email}`,
        relatedId: selectedRequest.id,
        relatedType: 'approval_request',
        read: false,
        createdAt: serverTimestamp()
      });

      setShowActionModal(false);
      setSelectedRequest(null);
      setActionType('');
      setActionComment('');
      setActionFiles([]);

    } catch (error) {
      console.error("Error processing action:", error);
      alert("Failed to process action. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const renderApprovalHistory = (request) => {
    if (!request.decisionMade) return null;

    return (
      <div style={{
        marginTop: DESIGN_SYSTEM.spacing.base,
        padding: DESIGN_SYSTEM.spacing.base,
        backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
        borderRadius: DESIGN_SYSTEM.borderRadius.base,
        border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
      }}>
        <h4 style={{
          margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
          fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
          color: DESIGN_SYSTEM.colors.text.primary
        }}>
          Decision History
        </h4>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: DESIGN_SYSTEM.spacing.sm,
          marginBottom: DESIGN_SYSTEM.spacing.sm
        }}>
          {getStatusBadge(request.status)}
          <span style={{
            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
            color: DESIGN_SYSTEM.colors.text.secondary
          }}>
            by {request.decisionByName} on {formatDate(request.decisionDate)}
          </span>
        </div>

        {request.decisionComment && (
          <div style={{
            padding: DESIGN_SYSTEM.spacing.sm,
            backgroundColor: DESIGN_SYSTEM.colors.background.primary,
            borderRadius: DESIGN_SYSTEM.borderRadius.base,
            borderLeft: `3px solid ${request.status === 'approved' ? DESIGN_SYSTEM.colors.success : DESIGN_SYSTEM.colors.error}`,
            marginBottom: DESIGN_SYSTEM.spacing.sm
          }}>
            <p style={{
              margin: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              {request.decisionComment}
            </p>
          </div>
        )}

        {request.decisionFiles?.length > 0 && (
          <div>
            <h5 style={{
              margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              color: DESIGN_SYSTEM.colors.text.secondary
            }}>
              Attached Files:
            </h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
              {request.decisionFiles.map((fileUrl, index) => (
                <button
                  key={index}
                  onClick={() => {
                    console.log('Downloading decision file:', fileUrl, request.decisionFileNames?.[index]);
                    downloadFile(fileUrl, request.decisionFileNames?.[index]);
                  }}
                  style={{
                    padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                    backgroundColor: DESIGN_SYSTEM.colors.primary[100],
                    color: DESIGN_SYSTEM.colors.primary[700],
                    border: `1px solid ${DESIGN_SYSTEM.colors.primary[300]}`,
                    borderRadius: DESIGN_SYSTEM.borderRadius.base,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                    cursor: 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  {request.decisionFileNames?.[index] || `File ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary, background: DESIGN_SYSTEM.colors.background.secondary, minHeight: "100vh" }}>
        <TopBar />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: `3px solid ${DESIGN_SYSTEM.colors.primary[200]}`,
              borderTop: `3px solid ${DESIGN_SYSTEM.colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ color: DESIGN_SYSTEM.colors.text.secondary }}>Loading approval requests...</p>
            {!currentUser && (
              <p style={{ color: DESIGN_SYSTEM.colors.error, marginTop: '8px' }}>
                Please ensure you are logged in
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={getPageContainerStyle()}>
      <TopBar />
      
      <div style={{ ...getContentContainerStyle(), paddingTop: DESIGN_SYSTEM.spacing['2xl'] }}>
        {/* Header */}
        <div style={{
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.pageThemes.neutral.gradient,
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
            color: DESIGN_SYSTEM.colors.text.inverse,
            marginBottom: DESIGN_SYSTEM.spacing.sm
          }}>
            Approval Requests
          </h1>
          <p style={{
            margin: 0,
            fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            opacity: 0.9
          }}>
            Review and make decisions on stage advancement requests
          </p>
        </div>

        {/* Filters, Search, and eSign */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          gap: DESIGN_SYSTEM.spacing.base,
          flexWrap: 'wrap'
        }}>
          {/* Left group: filters and search (search next to Rejected) */}
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            {['All', 'Pending', 'Approved', 'Rejected'].map(filter => (
              <button
                key={filter}
                onClick={() => setCurrentFilter(filter)}
                style={{
                  ...getButtonStyle(currentFilter === filter ? 'primary' : 'secondary', 'neutral')
                }}
              >
                {filter} ({filter === 'All' 
                  ? allRequests.length 
                  : allRequests.filter(r => r.status?.toLowerCase() === filter.toLowerCase()).length
                })
              </button>
            ))}
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                outline: 'none',
                minWidth: '220px',
                background: DESIGN_SYSTEM.colors.background.primary
              }}
            />
          </div>

          {/* Right: eSign quick button */}
          <div>
            <input type="file" accept="application/pdf" id="approval-loose-esign-input" style={{ display: 'none' }} onChange={async (e) => {
              try {
                const file = e?.target?.files?.[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                // Pass the File directly instead of an ArrayBuffer to avoid detached buffer issues
                openSignModal('', url, file.name, file);
                try { e.target.value = ''; } catch {}
              } catch {}
            }} />
            <button onClick={() => { try { document.getElementById('approval-loose-esign-input').click(); } catch {} }} style={{ ...getButtonStyle('secondary', 'neutral') }} title="eSign a PDF without creating a request">eSign</button>
          </div>
        </div>

        {/* Main Table */}
        <div style={{
          backgroundColor: DESIGN_SYSTEM.colors.background.primary,
          borderRadius: DESIGN_SYSTEM.borderRadius.lg,
          overflow: 'hidden',
          boxShadow: DESIGN_SYSTEM.shadows.sm
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 220px 160px 160px 160px 140px',
            gap: DESIGN_SYSTEM.spacing.sm,
            padding: DESIGN_SYSTEM.spacing.base,
            backgroundColor: DESIGN_SYSTEM.colors.secondary[50],
            borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
            color: DESIGN_SYSTEM.colors.text.secondary
          }}>
            <div>Request Title</div>
            <div>Name</div>
            <div>Requested By</div>
            <div>Date Requested</div>
            <div>Due Date</div>
            <div>Status</div>
          </div>

          {/* Table Body */}
          {currentRequests.length === 0 ? (
            <div style={{
              padding: DESIGN_SYSTEM.spacing.xl,
              textAlign: 'center',
              color: DESIGN_SYSTEM.colors.text.tertiary
            }}>
              <p style={{ margin: 0, fontSize: DESIGN_SYSTEM.typography.fontSize.base }}>
                No approval requests found
              </p>
            </div>
          ) : (
            currentRequests.map((request, idx) => (
              <div key={request.id}>
                {/* Main Row */}
                <div
                  onClick={() => handleRowClick(request.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 220px 160px 160px 160px 140px',
                    gap: DESIGN_SYSTEM.spacing.sm,
                    padding: DESIGN_SYSTEM.spacing.base,
                    borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: expandedRow === request.id 
                      ? DESIGN_SYSTEM.colors.primary[25]
                      : (idx % 2 === 1 ? DESIGN_SYSTEM.colors.secondary[50] : 'transparent')
                  }}
                  onMouseEnter={(e) => {
                    if (expandedRow !== request.id) {
                      e.target.style.backgroundColor = DESIGN_SYSTEM.colors.secondary[50];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (expandedRow !== request.id) {
                      e.target.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.xs }}>
                    <span style={{
                      display: 'inline-block',
                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                      borderRadius: DESIGN_SYSTEM.borderRadius.base,
                      background: DESIGN_SYSTEM.colors.secondary[100],
                      border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                      color: DESIGN_SYSTEM.colors.text.primary,
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold
                    }}>
                      {request.projectName || request.entityName || 'Project'}
                    </span>
                    <span style={{
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      color: DESIGN_SYSTEM.colors.text.primary,
                      fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
                    }}>
                      {request.requestTitle}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.xs }}>
                    {getRequestTypeBadge(request.requestType)}
                    <span
                      onClick={(e) => handleEntityClick(request, e)}
                      title={request.entityName}
                      style={{
                        display: 'inline-block',
                        padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                        borderRadius: DESIGN_SYSTEM.borderRadius.base,
                        background: DESIGN_SYSTEM.colors.background.primary,
                        border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                        color: DESIGN_SYSTEM.colors.text.primary,
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {request.entityName}
                    </span>
                  </div>
                  
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    color: DESIGN_SYSTEM.colors.text.secondary
                  }}>
                    {request.requestedByName}
                  </div>
                  
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    color: DESIGN_SYSTEM.colors.text.secondary
                  }}>
                    {formatDate(request.dateRequested)}
                  </div>
                  
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    color: DESIGN_SYSTEM.colors.text.secondary
                  }}>
                    {formatDate(request.dueDate) || 'No due date'}
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: DESIGN_SYSTEM.spacing.xs 
                  }}>
                    <div style={{ flex: '1' }}>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.requestedBy === currentUser?.uid && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(request, e);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: DESIGN_SYSTEM.colors.error,
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '2px',
                          transition: 'all 0.2s ease',
                          flexShrink: 0, // Prevent button from shrinking
                          width: '20px',
                          height: '20px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = `${DESIGN_SYSTEM.colors.error}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                        title="Delete Request"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedRow === request.id && (
                  <div style={{
                    padding: DESIGN_SYSTEM.spacing.lg,
                    backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                    borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr',
                      gap: DESIGN_SYSTEM.spacing.lg
                    }}>
                      {/* Left Column - Details */}
                      <div>
                        <h3 style={{
                          margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                          fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                          color: DESIGN_SYSTEM.colors.text.primary
                        }}>
                          {request.requestTitle}
                        </h3>
                        
                        {/* Stage Info */}
                        {request.currentStage && request.nextStage && (
                          <div style={{
                            padding: DESIGN_SYSTEM.spacing.sm,
                            backgroundColor: DESIGN_SYSTEM.colors.primary[50],
                            borderRadius: DESIGN_SYSTEM.borderRadius.base,
                            marginBottom: DESIGN_SYSTEM.spacing.base,
                            border: `1px solid ${DESIGN_SYSTEM.colors.primary[200]}`
                          }}>
                            <p style={{
                              margin: 0,
                              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                              color: DESIGN_SYSTEM.colors.text.primary
                            }}>
                              <strong>Stage Advancement:</strong> {request.currentStage} → {request.nextStage}
                            </p>
                          </div>
                        )}

                        {/* Description */}
                        <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
                          <h4 style={{
                            margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                            color: DESIGN_SYSTEM.colors.text.primary
                          }}>
                            Description
                          </h4>
                          <p style={{
                            margin: 0,
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            color: DESIGN_SYSTEM.colors.text.secondary,
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {request.requestDescription}
                          </p>
                        </div>

                        {(request.quotationFiles?.length > 0 || request.quotationData || request.attachedFiles?.length > 0) && (
                          <div style={{
                            marginBottom: DESIGN_SYSTEM.spacing.base,
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            columnGap: DESIGN_SYSTEM.spacing.lg,
                            alignItems: 'start'
                          }}>
                            {/* Left: Quotation */}
                            <div>
                              <h4 style={{
                                margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                                color: DESIGN_SYSTEM.colors.text.primary
                              }}>
                                Quotation
                              </h4>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
                                {(request.quotationFiles || []).map((fileUrl, index) => (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      const name = request.quotationFileNames?.[index] || `Quotation ${index + 1}`;
                                      downloadFile(fileUrl, name);
                                    }}
                                    style={{
                                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                                      backgroundColor: DESIGN_SYSTEM.colors.primary[100],
                                      color: DESIGN_SYSTEM.colors.primary[700],
                                      border: `1px solid ${DESIGN_SYSTEM.colors.primary[300]}`,
                                      borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                      fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                                      cursor: 'pointer',
                                      textDecoration: 'none'
                                    }}
                                  >
                                    {request.quotationFileNames?.[index] || `Quotation ${index + 1}`}
                                  </button>
                                ))}
                                {(!(request.quotationFiles && request.quotationFiles.length > 0) && request.quotationData) && (
                                  <button
                                    onClick={() => generatePdfFromQuote(request.quotationData)}
                                    style={{
                                      padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                                      backgroundColor: DESIGN_SYSTEM.colors.secondary[100],
                                      color: DESIGN_SYSTEM.colors.text.primary,
                                      border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                                      borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                      fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    View as PDF
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Right: Attachments */}
                            <div>
                              <h4 style={{
                                margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                                color: DESIGN_SYSTEM.colors.text.primary
                              }}>
                                Attachments
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.xs }}>
                                {(request.attachedFiles || []).map((fileUrl, index) => {
                                  const name = request.attachedFileNames?.[index] || `File ${index + 1}`;
                                  const isPdf = (name || '').toLowerCase().endsWith('.pdf');
                                  return (
                                    <div key={index} style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.xs, alignItems: 'center' }}>
                                      <button
                                        onClick={() => {
                                          downloadFile(fileUrl, name);
                                        }}
                                        style={{
                                          padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                                          backgroundColor: DESIGN_SYSTEM.colors.secondary[100],
                                          color: DESIGN_SYSTEM.colors.text.primary,
                                          border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                                          borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                          fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                                          cursor: 'pointer',
                                          textDecoration: 'none'
                                        }}
                                      >
                                        {name}
                                      </button>
                                      {isPdf && request.requestedTo === currentUser?.uid && request.status === 'pending' && (
                                        <button
                                          onClick={() => openSignModal(request.id, fileUrl, name)}
                                          style={{
                                            padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                                            backgroundColor: DESIGN_SYSTEM.colors.success + '20',
                                            color: DESIGN_SYSTEM.colors.success,
                                            border: `1px solid ${DESIGN_SYSTEM.colors.success}`,
                                            borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                            fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Sign
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Approval History */}
                        {renderApprovalHistory(request)}
                      </div>

                      {/* Right Column - Actions */}
                      <div>
                        <h4 style={{
                          margin: `0 0 ${DESIGN_SYSTEM.spacing.sm} 0`,
                          fontSize: DESIGN_SYSTEM.typography.fontSize.base,
                          fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                          color: DESIGN_SYSTEM.colors.text.primary
                        }}>
                          Actions
                        </h4>
                        
                        
                        {request.status === 'pending' && request.requestedTo === currentUser?.uid ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_SYSTEM.spacing.sm }}>
                            <button
                              onClick={(e) => openActionModal(request, 'approve', e)}
                              style={{
                                padding: DESIGN_SYSTEM.spacing.sm,
                                backgroundColor: DESIGN_SYSTEM.colors.success,
                                color: DESIGN_SYSTEM.colors.text.inverse,
                                border: 'none',
                                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => openActionModal(request, 'reject', e)}
                              style={{
                                padding: DESIGN_SYSTEM.spacing.sm,
                                backgroundColor: DESIGN_SYSTEM.colors.error,
                                color: DESIGN_SYSTEM.colors.text.inverse,
                                border: 'none',
                                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : request.status === 'pending' ? (
                          <p style={{
                            margin: 0,
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            color: DESIGN_SYSTEM.colors.text.tertiary,
                            fontStyle: 'italic'
                          }}>
                            Only {request.requestedToName} can make this decision
                          </p>
                        ) : (
                          <p style={{
                            margin: 0,
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            color: DESIGN_SYSTEM.colors.text.tertiary,
                            fontStyle: 'italic'
                          }}>
                            Decision already made
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: DESIGN_SYSTEM.spacing.lg,
            gap: DESIGN_SYSTEM.spacing.sm
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                color: DESIGN_SYSTEM.colors.text.primary,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              Previous
            </button>
            
            <span style={{
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              color: DESIGN_SYSTEM.colors.text.secondary
            }}>
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                color: DESIGN_SYSTEM.colors.text.primary,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: DESIGN_SYSTEM.colors.background.primary,
            borderRadius: DESIGN_SYSTEM.borderRadius.lg,
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'hidden',
            boxShadow: DESIGN_SYSTEM.shadows.xl
          }}>
            {/* Modal Header */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg,
              borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
              backgroundColor: actionType === 'approve' 
                ? `${DESIGN_SYSTEM.colors.success}15`
                : `${DESIGN_SYSTEM.colors.error}15`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>
                {actionType === 'approve' ? 'Approve' : 'Reject'} Request
              </h3>
              <p style={{
                margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                color: DESIGN_SYSTEM.colors.text.secondary
              }}>
                {selectedRequest.requestTitle}
              </p>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg,
              overflow: 'auto',
              maxHeight: '60vh'
            }}>
              {/* Comment */}
              <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
                <label style={{
                  display: 'block',
                  marginBottom: DESIGN_SYSTEM.spacing.xs,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                  color: DESIGN_SYSTEM.colors.text.primary
                }}>
                  Comment (Optional)
                </label>
                <textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder={`Add a comment about your ${actionType} decision...`}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: DESIGN_SYSTEM.spacing.sm,
                    border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                    borderRadius: DESIGN_SYSTEM.borderRadius.base,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary
                  }}
                  disabled={actionLoading}
                />
              </div>

              {/* File Attachments */}
              <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
                <label style={{
                  display: 'block',
                  marginBottom: DESIGN_SYSTEM.spacing.xs,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                  color: DESIGN_SYSTEM.colors.text.primary
                }}>
                  Attach Files (Optional)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{
                    width: '100%',
                    padding: DESIGN_SYSTEM.spacing.sm,
                    border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                    borderRadius: DESIGN_SYSTEM.borderRadius.base,
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    backgroundColor: DESIGN_SYSTEM.colors.background.secondary
                  }}
                  disabled={actionLoading}
                />
                
                {/* File List */}
                {actionFiles.length > 0 && (
                  <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm }}>
                    {actionFiles.map((file, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: DESIGN_SYSTEM.spacing.xs,
                        backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                        borderRadius: DESIGN_SYSTEM.borderRadius.base,
                        marginBottom: DESIGN_SYSTEM.spacing.xs
                      }}>
                        <span style={{
                          fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                          color: DESIGN_SYSTEM.colors.text.secondary
                        }}>
                          {file.name}
                        </span>
                        <button
                          onClick={() => removeActionFile(index)}
                          disabled={actionLoading}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: DESIGN_SYSTEM.colors.error,
                            cursor: 'pointer',
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            padding: DESIGN_SYSTEM.spacing.xs
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg,
              borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
              backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: DESIGN_SYSTEM.spacing.sm
            }}>
              <button
                onClick={() => setShowActionModal(false)}
                disabled={actionLoading}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                  color: DESIGN_SYSTEM.colors.text.secondary,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={processAction}
                disabled={actionLoading}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  border: 'none',
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  backgroundColor: actionType === 'approve' 
                    ? DESIGN_SYSTEM.colors.success
                    : DESIGN_SYSTEM.colors.error,
                  color: DESIGN_SYSTEM.colors.text.inverse,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.6 : 1,
                  minWidth: '100px'
                }}
              >
                {actionLoading ? 'Processing...' : (actionType === 'approve' ? 'Approve' : 'Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && requestToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: DESIGN_SYSTEM.colors.background.primary,
            borderRadius: DESIGN_SYSTEM.borderRadius.lg,
            width: '90%',
            maxWidth: '500px',
            overflow: 'hidden',
            boxShadow: DESIGN_SYSTEM.shadows.xl
          }}>
            {/* Modal Header */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg,
              borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
              backgroundColor: `${DESIGN_SYSTEM.colors.error}15`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.lg,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>
                Delete Approval Request
              </h3>
              <p style={{
                margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                color: DESIGN_SYSTEM.colors.text.secondary
              }}>
                Are you sure you want to delete this request?
              </p>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg
            }}>
              <div style={{
                padding: DESIGN_SYSTEM.spacing.sm,
                backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                borderLeft: `3px solid ${DESIGN_SYSTEM.colors.error}`,
                marginBottom: DESIGN_SYSTEM.spacing.base
              }}>
                <p style={{
                  margin: 0,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  color: DESIGN_SYSTEM.colors.text.primary,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
                }}>
                  {requestToDelete.requestTitle}
                </p>
                <p style={{
                  margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                  color: DESIGN_SYSTEM.colors.text.secondary
                }}>
                  {requestToDelete.entityName} • {requestToDelete.requestType}
                </p>
              </div>
              
              <p style={{
                margin: 0,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                color: DESIGN_SYSTEM.colors.text.secondary,
                lineHeight: 1.5
              }}>
                This action cannot be undone. The approval request will be permanently removed and any pending decisions will be lost.
              </p>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: DESIGN_SYSTEM.spacing.lg,
              borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
              backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: DESIGN_SYSTEM.spacing.sm
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                  color: DESIGN_SYSTEM.colors.text.secondary,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={deleteLoading}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  border: 'none',
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  backgroundColor: DESIGN_SYSTEM.colors.error,
                  color: DESIGN_SYSTEM.colors.text.inverse,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.6 : 1,
                  minWidth: '100px'
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {/* eSign Modal */}
      {showSignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '96%', maxWidth: 1200, maxHeight: '90vh', overflow: 'auto', boxShadow: DESIGN_SYSTEM.shadows.lg, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: DESIGN_SYSTEM.spacing.base, borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.sm }}>
              <div style={{ fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold }}>Sign PDF: {signTarget.fileName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.sm, flexWrap: 'wrap' }}>
                <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.xs, color: DESIGN_SYSTEM.colors.text.secondary }}>
                  If pen doesn't appear or size looks off, click Refresh then sign
                </span>
                <button onClick={refreshPdfLayout} style={{ ...getButtonStyle('secondary', 'neutral') }}>Refresh</button>
                <button onClick={() => setShowSignModal(false)} style={{ ...getButtonStyle('secondary', 'neutral') }}>Close</button>
              </div>
            </div>
            <div style={{ padding: DESIGN_SYSTEM.spacing.base }}>
              <div style={{ marginBottom: DESIGN_SYSTEM.spacing.sm, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.secondary }}>
                Review the document (full width with scrolling) and draw your signature below, then click Apply. A signed copy will be downloaded. Note: if the pen doesn't appear or size looks off, click Refresh to re-render before signing.
              </div>
              <div style={{ position: 'relative', border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, marginBottom: DESIGN_SYSTEM.spacing.sm, overflow: 'auto', height: '70vh' }}>
                <div ref={pdfContainerRef} style={{ position: 'relative', width: '100%', margin: '0 auto' }} />
                {pdfRenderFailed && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: 8 }}>PDF preview failed.</div>
                      <button onClick={() => window.open(signTarget.fileUrl, '_blank', 'noopener,noreferrer')} style={{ ...getButtonStyle('secondary', 'neutral') }}>Open PDF</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm, marginTop: DESIGN_SYSTEM.spacing.sm, position: 'sticky', bottom: 0, background: '#fff', paddingTop: DESIGN_SYSTEM.spacing.sm }}>
                <button onClick={clearSignature} style={{ ...getButtonStyle('secondary', 'neutral') }}>Clear</button>
                <button onClick={applySignature} disabled={!isSigning} style={{ ...getButtonStyle('primary', 'neutral'), opacity: isSigning ? 1 : 0.6, cursor: isSigning ? 'pointer' : 'not-allowed' }}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
