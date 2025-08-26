import React, { useState, useEffect } from "react";
import { DESIGN_SYSTEM } from "../../styles/designSystem";
import { db, storage } from '../../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAcceptedTeamMembersForProject } from "../../services/teamService";
import { getAcceptedTeamMembers } from "../../services/teamService";

export default function AdvancedApprovalRequestModal({
  isOpen,
  onClose,
  onSuccess,
  projectId = null,
  projectName = "",
  customerId = null,
  customerName = "",
  currentUser,
  currentStage = "",
  nextStage = "",
  isStageAdvancement = true, // New prop to determine if this is for stage advancement
  autoAttachQuotation = false,
  onCreateProject = null,
  customerProfileData = null,
  companyProfileData = null,
  quoteProjectId = null,
  quoteProjectName = "",
  selectedQuote = null,
  showCreateProjectFields = true,
  showNoApprovalToggle = true
}) {
  // Form data states
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [autoAttachedFiles, setAutoAttachedFiles] = useState([]); // URLs prefilled by system
  const [autoAttachedPdfFiles, setAutoAttachedPdfFiles] = useState([]); // PDF preview copies
  const [quoteAttachError, setQuoteAttachError] = useState("");
  const [selectedQuoteData, setSelectedQuoteData] = useState(null);
  const [selectedDecisionMaker, setSelectedDecisionMaker] = useState(null);
  const [selectedViewers, setSelectedViewers] = useState([]);
  const [allRecipients, setAllRecipients] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [decisionMakerSearchTerm, setDecisionMakerSearchTerm] = useState("");
  const [viewersSearchTerm, setViewersSearchTerm] = useState("");
  const [showDecisionMakerDropdown, setShowDecisionMakerDropdown] = useState(false);
  const [showViewersDropdown, setShowViewersDropdown] = useState(false);
  const [noApprovalNeeded, setNoApprovalNeeded] = useState(false);

  // Inline Create Project form states (mirror CreateProjectModal)
  const [cpProjectName, setCpProjectName] = useState("");
  const [cpCompanyName, setCpCompanyName] = useState("");
  const [cpCustomerEmail, setCpCustomerEmail] = useState("");
  const [cpCustomerName, setCpCustomerName] = useState("");
  const [cpTeamMembersEmails, setCpTeamMembersEmails] = useState([]);
  const [cpTeamMembers, setCpTeamMembers] = useState([]);
  const [cpNewMemberId, setCpNewMemberId] = useState("");
  const [cpSelectedStage, setCpSelectedStage] = useState("Planning");
  const [cpDeadline, setCpDeadline] = useState("");
  const [cpDescription, setCpDescription] = useState("");
  const [cpAllowJoinById, setCpAllowJoinById] = useState(true);
  const [cpAcceptedTeamMembers, setCpAcceptedTeamMembers] = useState([]);
  const [cpLoadingAcceptedMembers, setCpLoadingAcceptedMembers] = useState(false);

  // Quotation selection (modal-level) for conversion requests
  const [modalProjectQuotes, setModalProjectQuotes] = useState([]);
  const [selectedQuoteIdLocal, setSelectedQuoteIdLocal] = useState("");

  // Helper: generate a simple PDF from quote data
  const generatePdfFromQuote = async (quoteData, displayName = 'Quotation') => {
    try {
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, StandardFonts, rgb } = pdfLib;
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 portrait
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let y = 800;
      const left = 50;
      const line = (text, opts = {}) => {
        const { bold = false, size = 12, color = rgb(0, 0, 0) } = opts;
        page.drawText(String(text || ''), {
          x: left,
          y,
          size,
          font: bold ? fontBold : font,
          color
        });
        y -= size + 6;
      };

      line(displayName, { bold: true, size: 18 });
      line(`Client: ${quoteData.client || quoteData.customer || ''}`);
      line(`Date: ${new Date().toLocaleDateString()}`);
      line('');
      line('Items:', { bold: true });
      const items = Array.isArray(quoteData.items) ? quoteData.items : [];
      items.slice(0, 20).forEach((it, idx) => {
        const desc = it.description || it.name || `Item ${idx + 1}`;
        const qty = Number(it.qty || it.quantity || 1);
        const unit = Number(it.unitPrice || it.price || it.rate || 0);
        const total = (qty * unit).toFixed(2);
        line(`- ${desc}  x${qty}  @ ${unit} = ${total}`);
      });
      line('');
      const subtotal = items.reduce((s, it) => s + Number(it.qty || it.quantity || 1) * Number(it.unitPrice || it.price || it.rate || 0), 0);
      const taxRate = Number(quoteData.taxRate || 0);
      const discount = Number(quoteData.discount || 0);
      const taxed = subtotal * (taxRate / 100);
      const grand = subtotal + taxed - discount;
      line(`Subtotal: ${subtotal.toFixed(2)}`);
      line(`Tax (${taxRate}%): ${taxed.toFixed(2)}`);
      line(`Discount: ${discount.toFixed(2)}`);
      line(`Total: ${grand.toFixed(2)}`, { bold: true });

      const bytes = await pdfDoc.save();
      return new Blob([bytes], { type: 'application/pdf' });
    } catch (e) {
      console.warn('Failed to generate PDF from quote', e);
      return null;
    }
  };

  // Load quotes from project OR customer drafts when modal opens (conversion flow)
  useEffect(() => {
    const loadQuotes = async () => {
      try {
        if (!isOpen) { setModalProjectQuotes([]); setSelectedQuoteIdLocal(""); return; }
        const pid = projectId || quoteProjectId;
        let quotes = [];
        if (pid) {
          const snap = await getDocs(collection(db, 'projects', pid, 'quotes'));
          quotes = snap.docs.map(d => ({ id: d.id, scope: 'project', ...d.data() }));
        } else if (customerId) {
          const draftsSnap = await getDocs(collection(db, 'customerProfiles', customerId, 'quotesDrafts'));
          quotes = draftsSnap.docs
            .map(d => ({ id: d.id, scope: 'customer', ...d.data() }))
            // Exclude drafts already converted/moved to a project
            .filter(q => !q.projectId);
        }
        quotes.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
        setModalProjectQuotes(quotes);
        if (quotes.length > 0) {
          const chosenId = quotes[0].id;
          setSelectedQuoteIdLocal(prev => prev || chosenId);
          await attachQuoteById(chosenId, quotes);
        }
      } catch {
        setModalProjectQuotes([]);
      }
    };
    loadQuotes();
  }, [isOpen, projectId, quoteProjectId, customerId]);

  // Attach selected quote (original + PDF preview)
  const attachQuoteById = async (quoteId, quotesArray) => {
    try {
      const source = Array.isArray(quotesArray) ? quotesArray : modalProjectQuotes;
      const q = source.find(x => x.id === quoteId);
      if (!q) return;
      setAutoAttachedFiles([]);
      setAutoAttachedPdfFiles([]);
      const base = `quotation-${projectName || quoteProjectName || effectiveEntityName || 'proposal'}`;
      const originalUrl = q.fileUrl || q.attachmentUrl || q.originalUrl || q.sourceUrl || q.renderUrl;
      if (originalUrl) {
        const originalName = q.fileName || `${base}.quote`;
        setAutoAttachedFiles([{ url: originalUrl, name: originalName }]);
        setQuoteAttachError("");
      }
      if (!originalUrl) {
        // Do not generate files; approver will render PDF from data
        setQuoteAttachError("");
      }
      // Capture minimal data for approver-side PDF render
      const items = Array.isArray(q.items) ? q.items.map(it => ({
        description: it.description || it.name || '',
        qty: Number(it.qty || it.quantity || 1),
        unitPrice: Number(it.unitPrice || it.price || it.rate || 0)
      })) : [];
      const total = items.reduce((s,it)=> s + it.qty * it.unitPrice, 0);
      setSelectedQuoteData({
        id: q.id,
        scope: q.scope,
        name: q.name || q.title || '',
        client: q.client || q.customer || '',
        items,
        total,
        validUntil: q.validUntil || '',
        taxRate: Number(q.taxRate || 0),
        discount: Number(q.discount || 0)
      });
      // Skip adding PDF attachments per requirement
    } catch {}
  };

  // Request type - Project or Customer
  const requestType = projectId ? 'Project' : 'Customer';
  const entityId = projectId || customerId;
  const clean = (s) => {
    const t = (s || '').trim();
    if (!t) return '';
    if (/^unknown\b/i.test(t)) return '';
    return t;
  };
  const effectiveEntityName = requestType === 'Project'
    ? (projectName || quoteProjectName || 'Project')
    : (
        clean(customerName)
        || customerProfileData?.name
        || `${(customerProfileData?.firstName||'').trim()} ${(customerProfileData?.lastName||'').trim()}`.trim()
        || companyProfileData?.companyName
        || companyProfileData?.company
        || 'Customer'
      );

  // Fetch available recipients when modal opens
  useEffect(() => {
    const fetchRecipients = async () => {
      if (!isOpen || !currentUser) return;

      try {
        let recipients = [];
        
        if (projectId) {
          // For projects, get accepted team members
          recipients = await getAcceptedTeamMembersForProject(currentUser, projectId);
        } else if (customerId) {
          // For customers, include ALL accepted team members for the current user
          recipients = await getAcceptedTeamMembers(currentUser);
        }

        setAllRecipients(recipients);
      } catch (error) {
        console.error("Error fetching recipients:", error);
        setAllRecipients([]);
      }
    };

    fetchRecipients();
  }, [isOpen, currentUser, projectId, customerId]);

  // Reset form and optionally auto-attach quotation when modal opens/closes
  useEffect(() => {
    const maybeAttachQuotation = async () => {
      setRequestTitle("");
      setRequestDescription("");
      setAttachedFiles([]);
      setAutoAttachedFiles([]);
      setSelectedDecisionMaker(null);
      setSelectedViewers([]);
      setDecisionMakerSearchTerm("");
      setViewersSearchTerm("");
      setShowDecisionMakerDropdown(false);
      setShowViewersDropdown(false);
      setNoApprovalNeeded(false);
      
      // Set default title based on type and purpose
      if (isStageAdvancement) {
        if (requestType === 'Project') {
          setRequestTitle(`Advance ${effectiveEntityName} from ${currentStage} to ${nextStage}`);
        } else {
          setRequestTitle(`Advance ${effectiveEntityName} to Next Stage`);
        }
      } else {
        // Conversion flow (customer) vs generic approval
        if (requestType === 'Project') {
          setRequestTitle(`Approval Request for ${effectiveEntityName}`);
        } else {
          if (autoAttachQuotation) {
          setRequestTitle(`Convert Customer "${effectiveEntityName}" to Project`);
          } else {
            // Generic send approval from customer profile: use customer profile name without quotes
            const nameForTitle = (
              (customerProfileData?.name && customerProfileData.name.trim())
              || (`${(customerProfileData?.firstName||'').trim()} ${(customerProfileData?.lastName||'').trim()}`.trim())
              || (customerName || '').trim()
              || effectiveEntityName
            );
            setRequestTitle(`Approval Request for ${nameForTitle}`);
          }
        }
      }

      // Prefill minimal customer/company into inline project fields (leave name empty per requirement)
      setCpProjectName("");
      setCpCompanyName(companyProfileData?.company || companyProfileData?.companyName || "");
      setCpCustomerEmail(customerProfileData?.email || "");
      setCpCustomerName((customerProfileData?.name || `${customerProfileData?.firstName||''} ${customerProfileData?.lastName||''}`.trim()) || "");
      setCpTeamMembersEmails([]);
      setCpTeamMembers([]);
      setCpNewMemberId("");
      setCpSelectedStage("Planning");
      setCpDeadline("");
      setCpDescription(companyProfileData?.description || "");
      setCpAllowJoinById(true);

      // Prefer explicitly selected quotation if provided
      if (isOpen && selectedQuote) {
        try {
          const q = selectedQuote || {};
          const originalUrl = q.fileUrl || q.attachmentUrl || q.originalUrl || q.sourceUrl || q.renderUrl;
          const pdfUrl = q.pdfUrl || q.renderedPdfUrl || q.renderedPdf;
          const baseName = `quotation-${effectiveEntityName || quoteProjectName || 'proposal'}`;
          if (originalUrl) {
            setAutoAttachedFiles([{ url: originalUrl, name: `${baseName}${(q.fileName && q.fileName.includes('.')) ? '' : (q.extension ? `.${q.extension}` : '')}` || `${baseName}.quote` }]);
          }
          // Skip adding PDF attachments per requirement
        } catch (e) {
          console.warn('Failed to attach selected quotation', e);
        }
      } else if (isOpen && autoAttachQuotation) {
      // Auto-attach quotation based on selected project (if provided) else fallback to customer drafts
        try {
          if (quoteProjectId) {
            // Fetch latest quote from selected project
            const projQuotesSnap = await getDocs(collection(db, 'projects', quoteProjectId, 'quotes'));
            if (!projQuotesSnap.empty) {
              const docs = projQuotesSnap.docs;
              const last = docs[docs.length - 1];
              const q = last.data() || {};
              const originalUrl = q.fileUrl || q.attachmentUrl || q.originalUrl || q.sourceUrl || q.renderUrl;
              const pdfUrl = q.pdfUrl || q.renderedPdfUrl || q.renderedPdf;
              if (originalUrl) {
                const fileName = q.fileName || `quotation-${quoteProjectName || 'project'}.quote`;
                setAutoAttachedFiles([{ url: originalUrl, name: fileName }]);
              }
              // Skip adding PDF attachments per requirement
            }
          }
        } catch (err) {
          console.warn('Failed to auto-attach quotation:', err);
        }
      }
    };

    if (isOpen) {
      maybeAttachQuotation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load accepted team members for inline project form
  useEffect(() => {
    const loadAccepted = async () => {
      if (!isOpen || !currentUser) return;
      setCpLoadingAcceptedMembers(true);
      try {
        const members = await getAcceptedTeamMembers(currentUser);
        setCpAcceptedTeamMembers(members || []);
      } catch {
        setCpAcceptedTeamMembers([]);
      } finally {
        setCpLoadingAcceptedMembers(false);
      }
    };
    loadAccepted();
  }, [isOpen, currentUser]);

  // Resolve selected emails to user objects for chips
  useEffect(() => {
    const resolveMembers = async () => {
      // Map emails to display objects using accepted list (best-effort)
      const mapped = cpTeamMembersEmails.map(email => {
        const hit = cpAcceptedTeamMembers.find(m => m.email === email);
        return {
          uid: hit?.id || null,
          email,
          displayName: hit?.name || (email ? email.split('@')[0] : 'member')
        };
      });
      setCpTeamMembers(mapped);
    };
    resolveMembers();
  }, [cpTeamMembersEmails, cpAcceptedTeamMembers]);

  const cpAddMember = () => {
    if (!cpNewMemberId) return;
    const selected = cpAcceptedTeamMembers.find(m => m.id === cpNewMemberId);
    if (selected && !cpTeamMembersEmails.includes(selected.email)) {
      setCpTeamMembersEmails(prev => [...prev, selected.email]);
      setCpNewMemberId("");
    }
  };

  const cpRemoveMember = (email) => {
    setCpTeamMembersEmails(prev => prev.filter(e => e !== email));
  };

  const cpSubmitCreateProject = async () => {
    if (!onCreateProject || !cpProjectName.trim() || !currentUser) return;
    // Resolve emails -> UIDs
    let resolvedTeam = [];
    try {
      const chunkSize = 10;
      for (let i = 0; i < cpTeamMembersEmails.length; i += chunkSize) {
        const chunk = cpTeamMembersEmails.slice(i, i + chunkSize);
        const usersQuery = query(collection(db, "users"), where("email", "in", chunk));
        const usersSnapshot = await getDocs(usersQuery);
        const uidByEmail = new Map();
        usersSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.email) uidByEmail.set(data.email, data.uid || docSnap.id);
        });
        chunk.forEach(email => {
          const uid = uidByEmail.get(email);
          if (uid) resolvedTeam.push(uid);
        });
      }
    } catch {}

    await Promise.resolve(onCreateProject({
      name: cpProjectName.trim(),
      company: cpCompanyName.trim(),
      contactEmail: cpCustomerEmail.trim(),
      customerName: cpCustomerName.trim(),
      companyInfo: {
        companyName: cpCompanyName.trim(),
        customerEmail: cpCustomerEmail.trim(),
        customerName: cpCustomerName.trim()
      },
      team: resolvedTeam,
      stage: 'Planning',
      description: cpDescription,
      deadline: cpDeadline || '',
      ownerId: currentUser.uid,
      allowJoinById: cpAllowJoinById,
      // pass selected draft quote id when converting from customer
      selectedDraftQuoteId: (customerId && selectedQuoteIdLocal) ? selectedQuoteIdLocal : undefined
    })).catch(()=>{});
    onClose();
  };

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const selectDecisionMaker = (recipient) => {
    setSelectedDecisionMaker(recipient);
    setDecisionMakerSearchTerm(recipient.name);
    setShowDecisionMakerDropdown(false);
  };

  const toggleViewer = (recipient) => {
    setSelectedViewers(prev => {
      const isSelected = prev.some(v => v.id === recipient.id);
      if (isSelected) {
        return prev.filter(v => v.id !== recipient.id);
      } else {
        return [...prev, recipient];
      }
    });
  };

  const removeViewer = (viewerId) => {
    setSelectedViewers(prev => prev.filter(v => v.id !== viewerId));
  };

  const filteredDecisionMakers = allRecipients.filter(recipient =>
    recipient.name.toLowerCase().includes(decisionMakerSearchTerm.toLowerCase()) ||
    recipient.email.toLowerCase().includes(decisionMakerSearchTerm.toLowerCase())
  );

  const filteredViewers = allRecipients.filter(recipient =>
    recipient.name.toLowerCase().includes(viewersSearchTerm.toLowerCase()) ||
    recipient.email.toLowerCase().includes(viewersSearchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (noApprovalNeeded) {
      // Bypass all validations and approvals
      try {
        if (isStageAdvancement) {
          if (projectId && nextStage) {
            await updateDoc(doc(db, 'projects', projectId), { stage: nextStage });
          }
          // Optionally handle customer stage here in future
        }
      } catch {}
      if (onSuccess) {
        onSuccess({
          type: requestType,
          entityName: effectiveEntityName,
          decisionMaker: 'n/a',
          viewerCount: 0,
          title: requestTitle || `Advance ${effectiveEntityName} to ${nextStage}`,
          bypassed: true,
          nextStage
        });
      }
      onClose();
      return;
    }
    if (!requestTitle.trim()) {
      alert("Please enter a request title.");
      return;
    }

    // Description optional per request

    if (!noApprovalNeeded && !selectedDecisionMaker) {
      alert("Please select a decision maker.");
      return;
    }

    // Prevent sender from making decision for themselves
    if (selectedDecisionMaker.id === currentUser.uid) {
      alert("You cannot select yourself as a decision maker.");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Ensure quotation is attached if configured but not yet populated
      if (!isStageAdvancement && autoAttachQuotation && (autoAttachedFiles.length === 0 && autoAttachedPdfFiles.length === 0)) {
        try {
          if (selectedQuoteIdLocal && modalProjectQuotes.length > 0) {
            await attachQuoteById(selectedQuoteIdLocal, modalProjectQuotes);
          } else {
            // Attempt to load latest quotes on-demand
            const pid = projectId || quoteProjectId || null;
            let quotes = [];
            if (pid) {
              const snap = await getDocs(collection(db, 'projects', pid, 'quotes'));
              quotes = snap.docs.map(d => ({ id: d.id, scope: 'project', ...d.data() }));
            } else if (customerId) {
              const draftsSnap = await getDocs(collection(db, 'customerProfiles', customerId, 'quotesDrafts'));
              quotes = draftsSnap.docs.map(d => ({ id: d.id, scope: 'customer', ...d.data() })).filter(q => !q.projectId);
            }
            if (quotes.length > 0) {
              quotes.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
              await attachQuoteById(quotes[0].id, quotes);
            }
          }
        } catch {}
      }

      // Upload files first (original attachments selected by user)
      const fileUrls = [];
      const fileNames = [];
      const quotationUrls = [];
      const quotationNames = [];

      // Include auto-attached files
      (autoAttachedFiles || []).forEach(f => {
        if (f?.url && f?.name) {
          fileUrls.push(f.url);
          fileNames.push(f.name);
        }
      });

      for (let i = 0; i < attachedFiles.length; i++) {
        const file = attachedFiles[i];
        const storageRef = ref(storage, `approval_files/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(prev => ({ ...prev, [i]: progress }));
            },
            (error) => {
              console.error("File upload error:", error);
              reject(error);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              fileUrls.push(downloadURL);
              fileNames.push(file.name);
              resolve();
            }
          );
        });
      }

      setUploading(false);

      // Include ONLY original quotation attachments (no PDFs) and keep separate from general attachments
      (autoAttachedFiles || []).forEach(f => { if (f?.url && f?.name) { quotationUrls.push(f.url); quotationNames.push(f.name); } });

      // Create a single approval request with decision maker and viewers
      const approvalRequest = await addDoc(collection(db, "approvalRequests"), {
          // Request metadata
          requestTitle: requestTitle.trim(),
          requestDescription: requestDescription.trim(),
          requestType, // 'Project' or 'Customer'
          
          // Entity information
          entityId,
          entityName: effectiveEntityName,
          projectId: projectId || null,
          projectName: projectName || "",
          customerId: customerId || null,
          customerName: customerName || "",
          
          // Stage information
          currentStage: currentStage || "",
          nextStage: isStageAdvancement ? (nextStage || "") : "",
          isStageAdvancement: isStageAdvancement,
          
          // File attachments
          attachedFiles: fileUrls,
          attachedFileNames: fileNames,
          quotationFiles: quotationUrls,
          quotationFileNames: quotationNames,
          // Proposed project (for conversion flow) - used on approval to create project
          proposedProject: (!isStageAdvancement ? {
            name: cpProjectName.trim(),
            description: cpDescription,
            deadline: cpDeadline || null,
            company: cpCompanyName,
            customerName: cpCustomerName,
            customerEmail: cpCustomerEmail
          } : null),
          quotationData: selectedQuoteData || null,
          // Include selected draft id so approval flow can migrate only that one
          selectedDraftQuoteId: selectedQuoteIdLocal || null,
          
          // User information
          requestedBy: currentUser.uid,
          requestedByName: currentUser.name || currentUser.displayName || currentUser.email,
          requestedByEmail: currentUser.email,
          
          // Decision maker (who can approve/reject)
          requestedTo: selectedDecisionMaker.id,
          requestedToName: selectedDecisionMaker.name,
          requestedToEmail: selectedDecisionMaker.email,
          
          // Viewers (who can see but not decide)
          viewers: selectedViewers.map(viewer => viewer.id),
          viewerDetails: selectedViewers.map(viewer => ({
            id: viewer.id,
            name: viewer.name,
            email: viewer.email
          })),
          
          // Status and timing
          status: "pending",
          dateRequested: serverTimestamp(),
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          
          // Upload traces
          uploadStatus: uploading ? "uploading" : "done",
          uploadProgress: uploading ? uploadProgress : {},
          
          // Decision tracking
          decisionMade: false,
          decisionBy: null,
          decisionDate: null,
          decisionComment: "",
          decisionFiles: [],
          
          // Audit trail
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

      // Single approval request created (no need for Promise.all)
      // Write notifications: decision maker + viewers + requester (confirmation)
      try {
        // Decision maker
        if (selectedDecisionMaker?.id) {
          await addDoc(collection(db, 'users', selectedDecisionMaker.id, 'notifications'), {
            unread: true,
            createdAt: serverTimestamp(),
            origin: 'approval',
            title: 'Approval request',
            message: `${currentUser.displayName || currentUser.email} requested your approval: ${requestTitle} (${requestType}: ${effectiveEntityName})`,
            refType: 'approval',
            approvalId: approvalRequest.id,
            projectId: projectId || null,
            customerId: customerId || null
          });
        }
        // Viewers
        for (const viewer of selectedViewers) {
          try {
            await addDoc(collection(db, 'users', viewer.id, 'notifications'), {
              unread: true,
              createdAt: serverTimestamp(),
              origin: 'approval',
              title: 'Approval shared',
              message: `You were added as a viewer: ${requestTitle} (${requestType}: ${effectiveEntityName})`,
              refType: 'approval',
              approvalId: approvalRequest.id,
              projectId: projectId || null,
              customerId: customerId || null
            });
          } catch {}
        }
        // Requester confirmation
        await addDoc(collection(db, 'users', currentUser.uid, 'notifications'), {
          unread: true,
          createdAt: serverTimestamp(),
          origin: 'approval',
          title: 'Approval request sent',
          message: `Sent to ${selectedDecisionMaker?.name || 'assignee'} • ${requestTitle}`,
          refType: 'approval',
          approvalId: approvalRequest.id,
          projectId: projectId || null,
          customerId: customerId || null
        });
      } catch {}

      // Success callback
      if (onSuccess) {
        onSuccess({
          type: requestType,
          entityName: effectiveEntityName,
          decisionMaker: selectedDecisionMaker.name,
          viewerCount: selectedViewers.length,
          title: requestTitle,
          nextStage: isStageAdvancement ? nextStage : undefined
        });
      }

      onClose();
    } catch (error) {
      console.error("Error creating approval request:", error);
      alert("Failed to send approval request. Please try again.");
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        backgroundColor: DESIGN_SYSTEM.colors.background.primary,
        borderRadius: DESIGN_SYSTEM.borderRadius.lg,
        width: "90%",
        maxWidth: "800px",
        maxHeight: "90vh",
        overflow: "hidden",
        boxShadow: DESIGN_SYSTEM.shadows.xl,
        display: "flex",
        flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
          background: requestType === 'Project' 
            ? DESIGN_SYSTEM.pageThemes.projects.cardGradient
            : DESIGN_SYSTEM.pageThemes.customers.cardGradient
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: DESIGN_SYSTEM.spacing.sm }}>
            <div style={{
              padding: DESIGN_SYSTEM.spacing.xs,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: requestType === 'Project' 
                ? DESIGN_SYSTEM.pageThemes.projects.accent
                : DESIGN_SYSTEM.pageThemes.customers.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              minWidth: "80px",
              textAlign: "center"
            }}>
              {requestType}
            </div>
            <h2 style={{
              margin: 0,
              fontSize: DESIGN_SYSTEM.typography.fontSize.xl,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              {(!isStageAdvancement && requestType === 'Customer' && !autoAttachQuotation) ? 'Send Approval' : (
                (!isStageAdvancement && requestType === 'Customer' && autoAttachQuotation) ? 'Project Conversion' : (
                  isStageAdvancement ? 'Get approval & advance stage' : 'Send approval'
                )
              )}
            </h2>
          </div>
          <p style={{
            margin: `${DESIGN_SYSTEM.spacing.xs} 0 0 0`,
            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
            color: DESIGN_SYSTEM.colors.text.secondary
          }}>
            {effectiveEntityName} {isStageAdvancement && currentStage && nextStage && `• ${currentStage} → ${nextStage}`}
          </p>
          {(autoAttachedFiles.length > 0 || autoAttachedPdfFiles.length > 0) && (
            <div style={{ marginTop: DESIGN_SYSTEM.spacing.xs }}>
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.xs, color: DESIGN_SYSTEM.colors.text.secondary }}>
                Attached quotation:
              </span>
              <span style={{ marginLeft: 6 }}>
                {/* Original format(s) */}
                {autoAttachedFiles.map((f, idx) => (
                  <a key={`orig-${idx}`} href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.xs, color: DESIGN_SYSTEM.colors.primary[600], textDecoration: 'underline', marginRight: 8 }}>
                    {f.name}
                  </a>
                ))}
                {/* PDF preview */}
                {autoAttachedPdfFiles.map((f, idx) => (
                  <a key={`pdf-${idx}`} href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.xs, color: DESIGN_SYSTEM.colors.primary[700], textDecoration: 'underline', marginRight: 8 }}>
                    View PDF
                  </a>
                ))}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          overflow: "auto",
          flex: 1
        }}>
          {/* Quotation Selection (required for conversion) */}
          {(!isStageAdvancement && autoAttachQuotation) && (
            <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
              <label style={{
                display: "block",
                marginBottom: DESIGN_SYSTEM.spacing.xs,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>
                Quotation (required for conversion)
              </label>
              <select
                value={selectedQuoteIdLocal}
                onChange={async (e) => {
                  setSelectedQuoteIdLocal(e.target.value);
                  setQuoteAttachError("");
                  await attachQuoteById(e.target.value);
                }}
                disabled={modalProjectQuotes.length === 0 || loading}
                style={{
                  width: '100%',
                  padding: DESIGN_SYSTEM.spacing.sm,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                }}
              >
                {modalProjectQuotes.length === 0 && (
                  <option value="">No quotes found (select a project or add drafts)</option>
                )}
                {modalProjectQuotes.length > 0 && (
                  <>
                    {modalProjectQuotes.some(q => q.scope === 'project') && (
                      <optgroup label="Project Quotes">
                        {modalProjectQuotes.filter(q => q.scope === 'project').map((q, idx) => {
                          const label = q.name || q.title || q.client || `Quote ${idx + 1}`;
                          const total = Number(q.total || 0);
                          const suffix = isNaN(total) || total === 0 ? '' : ` • Total ${total.toFixed(2)}`;
                          return (
                            <option key={q.id} value={q.id}>{`${label}${suffix}`}</option>
                          );
                        })}
                      </optgroup>
                    )}
                    {modalProjectQuotes.some(q => q.scope === 'customer') && (
                      <optgroup label="Customer Drafts">
                        {modalProjectQuotes.filter(q => q.scope === 'customer').map((q, idx) => {
                          const label = q.name || q.title || q.client || `Draft ${idx + 1}`;
                          const total = Number(q.total || 0);
                          const suffix = isNaN(total) || total === 0 ? '' : ` • Total ${total.toFixed(2)}`;
                          return (
                            <option key={q.id} value={q.id}>{`${label}${suffix}`}</option>
                          );
                        })}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
              {quoteAttachError && (
                <div style={{ marginTop: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.xs, color: DESIGN_SYSTEM.colors.error }}>
                  {quoteAttachError}
                </div>
              )}
            </div>
          )}
          {/* No approval needed toggle: show only for conversion and stage-advance flows */}
          {showNoApprovalToggle && (autoAttachQuotation || isStageAdvancement) && (
          <div style={{
            marginBottom: DESIGN_SYSTEM.spacing.base,
            padding: DESIGN_SYSTEM.spacing.sm,
            border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
            borderRadius: DESIGN_SYSTEM.borderRadius.base,
            background: DESIGN_SYSTEM.colors.background.secondary
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={noApprovalNeeded} onChange={(e) => setNoApprovalNeeded(e.target.checked)} />
              <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>
                No approval needed ({isStageAdvancement ? 'advance immediately' : 'do not send approval'})
              </span>
            </label>
          </div>
          )}

          {!noApprovalNeeded && (
            <>
          {/* Request Title */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Request Title *
            </label>
            <input
              type="text"
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder="Enter a clear, descriptive title for this request"
              style={{
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                outline: "none",
                transition: "border-color 0.2s ease",
                ":focus": {
                  borderColor: DESIGN_SYSTEM.colors.primary[500]
                }
              }}
              disabled={loading}
              maxLength={200}
            />
          </div>

          

          {/* Request Description (optional) */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Description (optional)
            </label>
            <textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              placeholder="Provide detailed context about why this stage advancement is needed..."
              rows={4}
              style={{
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                outline: "none",
                resize: "vertical",
                transition: "border-color 0.2s ease",
                fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary
              }}
              disabled={loading}
              maxLength={1000}
            />
          </div>

          {/* Due Date / Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base, marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: DESIGN_SYSTEM.spacing.xs,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>Due Date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%', padding: DESIGN_SYSTEM.spacing.sm, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: DESIGN_SYSTEM.borderRadius.base, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }} />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: DESIGN_SYSTEM.spacing.xs,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                color: DESIGN_SYSTEM.colors.text.primary
              }}>Due Time (optional)</label>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} style={{ width: '100%', padding: DESIGN_SYSTEM.spacing.sm, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: DESIGN_SYSTEM.borderRadius.base, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }} />
            </div>
          </div>

          

          {/* File Attachments */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
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
                width: "100%",
                padding: DESIGN_SYSTEM.spacing.sm,
                border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                backgroundColor: DESIGN_SYSTEM.colors.background.secondary
              }}
              disabled={loading}
            />
            
            {/* Prefilled auto-attachments */}
            {autoAttachedFiles.length > 0 && (
              <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm }}>
                {autoAttachedFiles.map((file, index) => (
                  <div key={`auto-${index}`} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: DESIGN_SYSTEM.spacing.xs,
                    backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
                    borderRadius: DESIGN_SYSTEM.borderRadius.base,
                    marginBottom: DESIGN_SYSTEM.spacing.xs
                  }}>
                    <span style={{
                      fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                      color: DESIGN_SYSTEM.colors.text.secondary
                    }}>
                      {file.name} (auto-attached)
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {/* File List */}
            {attachedFiles.length > 0 && (
              <div style={{ marginTop: DESIGN_SYSTEM.spacing.sm }}>
                {attachedFiles.map((file, index) => (
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
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
                    {uploading && uploadProgress[index] !== undefined && (
                      <span style={{
                        fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                        color: DESIGN_SYSTEM.colors.primary[500]
                      }}>
                        {Math.round(uploadProgress[index])}%
                      </span>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      disabled={loading}
                      style={{
                        background: "none",
                        border: "none",
                        color: DESIGN_SYSTEM.colors.error,
                        cursor: "pointer",
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

          {/* Decision Maker Selection */}
          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
            <label style={{
              display: "block",
              marginBottom: DESIGN_SYSTEM.spacing.xs,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>
              Select Decision Maker * (Who can approve/reject)
            </label>
            
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={decisionMakerSearchTerm}
                onChange={(e) => {
                  setDecisionMakerSearchTerm(e.target.value);
                  setShowDecisionMakerDropdown(true);
                }}
                onFocus={() => setShowDecisionMakerDropdown(true)}
                placeholder="Search for decision maker..."
                style={{
                  width: "100%",
                  padding: DESIGN_SYSTEM.spacing.sm,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  outline: "none"
                }}
                disabled={loading || noApprovalNeeded}
              />
              
              {showDecisionMakerDropdown && !noApprovalNeeded && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: DESIGN_SYSTEM.colors.background.primary,
                  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  boxShadow: DESIGN_SYSTEM.shadows.lg,
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 10,
                  marginTop: "2px"
                }}>
                  {filteredDecisionMakers.length === 0 ? (
                    <div style={{
                      padding: DESIGN_SYSTEM.spacing.sm,
                      color: DESIGN_SYSTEM.colors.text.tertiary,
                      textAlign: "center"
                    }}>
                      No team members found
                    </div>
                  ) : (
                    filteredDecisionMakers.map(recipient => (
                      <div
                        key={recipient.id}
                        onClick={() => selectDecisionMaker(recipient)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: DESIGN_SYSTEM.spacing.sm,
                          cursor: "pointer",
                          backgroundColor: selectedDecisionMaker?.id === recipient.id
                            ? DESIGN_SYSTEM.colors.primary[50]
                            : "transparent",
                          borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`
                        }}
                      >
                        <input
                          type="radio"
                          checked={selectedDecisionMaker?.id === recipient.id}
                          onChange={() => selectDecisionMaker(recipient)}
                          style={{ marginRight: DESIGN_SYSTEM.spacing.sm }}
                        />
                        <div>
                          <div style={{
                            fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                            color: DESIGN_SYSTEM.colors.text.primary,
                            fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
                          }}>
                            {recipient.name}
                          </div>
                          <div style={{
                            fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                            color: DESIGN_SYSTEM.colors.text.tertiary
                          }}>
                            {recipient.email}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Selected Decision Maker */}
            {selectedDecisionMaker && !noApprovalNeeded && (
              <div style={{
                marginTop: DESIGN_SYSTEM.spacing.sm,
                padding: `${DESIGN_SYSTEM.spacing.xs} ${DESIGN_SYSTEM.spacing.sm}`,
                backgroundColor: DESIGN_SYSTEM.colors.success + '20',
                borderRadius: DESIGN_SYSTEM.borderRadius.base,
                border: `1px solid ${DESIGN_SYSTEM.colors.success}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                    color: DESIGN_SYSTEM.colors.text.primary
                  }}>
                    {selectedDecisionMaker.name}
                  </div>
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.xs,
                    color: DESIGN_SYSTEM.colors.text.secondary
                  }}>
                    Decision Maker
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedDecisionMaker(null);
                    setDecisionMakerSearchTerm("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: DESIGN_SYSTEM.colors.text.secondary,
                    cursor: "pointer",
                    fontSize: "16px",
                    padding: "0",
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
            </>
          )}

          {/* Inline Create Project (conversion only) */}
          {(!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields) && (
          <div style={{
            marginTop: DESIGN_SYSTEM.spacing.lg,
            padding: DESIGN_SYSTEM.spacing.base,
            border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
            borderRadius: DESIGN_SYSTEM.borderRadius.base,
            background: DESIGN_SYSTEM.colors.background.secondary
          }}>
            <div style={{
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.semibold,
              marginBottom: DESIGN_SYSTEM.spacing.base,
              color: DESIGN_SYSTEM.colors.text.primary
            }}>Create Project</div>

            <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Project Name *</label>
              <input type="text" value={cpProjectName} onChange={(e) => setCpProjectName(e.target.value)} placeholder="Enter project name" style={{ width: '100%', padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
            </div>

            <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Description</label>
              <textarea value={cpDescription} onChange={(e) => setCpDescription(e.target.value)} placeholder="Enter project description" style={{ width: '100%', minHeight: 80, padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Company</label>
                <input type="text" value={cpCompanyName} onChange={(e) => setCpCompanyName(e.target.value)} placeholder="Company name" style={{ width: '100%', padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Customer Name</label>
                <input type="text" value={cpCustomerName} onChange={(e) => setCpCustomerName(e.target.value)} placeholder="Customer full name" style={{ width: '100%', padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
              </div>
            </div>

            <div style={{ marginTop: DESIGN_SYSTEM.spacing.base }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Customer Email</label>
              <input type="email" value={cpCustomerEmail} onChange={(e) => setCpCustomerEmail(e.target.value)} placeholder="customer@example.com" style={{ width: '100%', padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_SYSTEM.spacing.base, marginTop: DESIGN_SYSTEM.spacing.base }}>
              {/* Stage selection removed; default will be Planning */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Deadline</label>
                <input type="date" value={cpDeadline} onChange={(e) => setCpDeadline(e.target.value)} style={{ width: '100%', padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: DESIGN_SYSTEM.spacing.base }}>
              <input type="checkbox" id="cpAllowJoinById" checked={cpAllowJoinById} onChange={(e) => setCpAllowJoinById(e.target.checked)} />
              <label htmlFor="cpAllowJoinById" style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>Allow others to join by Project ID</label>
            </div>

            <div style={{ marginTop: DESIGN_SYSTEM.spacing.base }}>
              <div style={{ marginBottom: 6, fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary, fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium }}>Team Members</div>
              {cpLoadingAcceptedMembers ? (
                <div style={{ color: DESIGN_SYSTEM.colors.text.secondary, fontSize: DESIGN_SYSTEM.typography.fontSize.sm }}>Loading accepted team members...</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select value={cpNewMemberId} onChange={(e) => setCpNewMemberId(e.target.value)} style={{ flex: 1, padding: 10, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, borderRadius: 8 }}>
                    <option value="">-- Select from accepted team --</option>
                    {cpAcceptedTeamMembers
                      .filter(member => !cpTeamMembersEmails.includes(member.email))
                      .map(member => (
                        <option key={member.id} value={member.id}>{member.name} ({member.email})</option>
                      ))}
                  </select>
                  <button onClick={cpAddMember} disabled={!cpNewMemberId} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`, background: DESIGN_SYSTEM.colors.background.primary }}>Add</button>
                </div>
              )}

              {cpTeamMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {cpTeamMembers.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: DESIGN_SYSTEM.colors.background.primary, border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`, borderRadius: 16, padding: '4px 10px' }}>
                      <span style={{ fontSize: DESIGN_SYSTEM.typography.fontSize.sm, color: DESIGN_SYSTEM.colors.text.primary }}>{m.displayName}</span>
                      <button onClick={() => cpRemoveMember(m.email)} style={{ background: 'none', border: 'none', color: DESIGN_SYSTEM.colors.error, cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: DESIGN_SYSTEM.spacing.lg,
          borderTop: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
          backgroundColor: DESIGN_SYSTEM.colors.background.secondary,
          display: "flex",
          justifyContent: "flex-end",
          gap: DESIGN_SYSTEM.spacing.sm
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
              border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: DESIGN_SYSTEM.colors.background.primary,
              color: DESIGN_SYSTEM.colors.text.secondary,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={(!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields && noApprovalNeeded) ? cpSubmitCreateProject : handleSubmit}
            disabled={(!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields && noApprovalNeeded)
              ? (!onCreateProject || !cpProjectName.trim())
              : (loading || (!requestTitle.trim() || !selectedDecisionMaker))}
            style={{
              padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
              border: "none",
              borderRadius: DESIGN_SYSTEM.borderRadius.base,
              backgroundColor: requestType === 'Project' 
                ? DESIGN_SYSTEM.pageThemes.projects.accent
                : DESIGN_SYSTEM.pageThemes.customers.accent,
              color: DESIGN_SYSTEM.colors.text.inverse,
              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
              cursor: ((!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields && noApprovalNeeded) ? (!onCreateProject || !cpProjectName.trim()) : loading) ? "not-allowed" : "pointer",
              opacity: ((!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields && noApprovalNeeded) ? (!onCreateProject || !cpProjectName.trim()) : (loading || (!requestTitle.trim() || !selectedDecisionMaker))) ? 0.6 : 1,
              minWidth: "140px"
            }}
          >
            {(!isStageAdvancement && requestType === 'Customer' && !projectId && showCreateProjectFields && noApprovalNeeded) ? 'Create Project' : (loading ? (uploading ? 'Uploading...' : 'Sending...') : 'Send Request')}
          </button>
        </div>
      </div>
    </div>
  );
}
