import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { DESIGN_SYSTEM } from '../styles/designSystem';
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
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

  const REQUESTS_PER_PAGE = 10;

  // Fetch approval requests
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log('Fetching approval requests for user:', currentUser.uid);

    // Fetch all approval requests - everyone can see all requests
    const q = query(
      collection(db, 'approvalRequests')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        console.log('Approval requests snapshot received:', snapshot.docs.length, 'documents');
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Request data:', data);
          return {
            id: doc.id,
            ...data,
            dateRequested: data.dateRequested?.toDate(),
            decisionDate: data.decisionDate?.toDate(),
            dueDate: data.dueDate?.toDate()
          };
        });
        
        // Sort by dateRequested in JavaScript instead of Firestore
        requests.sort((a, b) => {
          if (!a.dateRequested && !b.dateRequested) return 0;
          if (!a.dateRequested) return 1;
          if (!b.dateRequested) return -1;
          return b.dateRequested.getTime() - a.dateRequested.getTime();
        });
        
        setAllRequests(requests);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching approval requests:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
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
        borderRadius: DESIGN_SYSTEM.borderRadius.full,
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
      setShowDeleteModal(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error("Error deleting approval request:", error);
      alert("Failed to delete approval request. Please try again.");
    } finally {
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
                  📎 {request.decisionFileNames?.[index] || `File ${index + 1}`}
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
    <div style={{ 
      fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary, 
      background: DESIGN_SYSTEM.colors.background.secondary, 
      minHeight: "100vh" 
    }}>
      <TopBar />
      
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: DESIGN_SYSTEM.spacing.xl
      }}>
        {/* Header */}
        <div style={{
          marginBottom: DESIGN_SYSTEM.spacing.xl,
          background: DESIGN_SYSTEM.colors.background.primary,
          borderRadius: DESIGN_SYSTEM.borderRadius.lg,
          padding: DESIGN_SYSTEM.spacing.lg,
          boxShadow: DESIGN_SYSTEM.shadows.sm
        }}>
          <h1 style={{
            margin: 0,
            fontSize: DESIGN_SYSTEM.typography.fontSize["2xl"],
            fontWeight: DESIGN_SYSTEM.typography.fontWeight.bold,
            color: DESIGN_SYSTEM.colors.text.primary,
            marginBottom: DESIGN_SYSTEM.spacing.sm
          }}>
            Approval Requests
          </h1>
          <p style={{
            margin: 0,
            fontSize: DESIGN_SYSTEM.typography.fontSize.base,
            color: DESIGN_SYSTEM.colors.text.secondary
          }}>
            Review and make decisions on stage advancement requests
          </p>
        </div>

        {/* Filters and Search */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: DESIGN_SYSTEM.spacing.lg,
          gap: DESIGN_SYSTEM.spacing.base,
          flexWrap: 'wrap'
        }}>
          {/* Status Filters */}
          <div style={{ display: 'flex', gap: DESIGN_SYSTEM.spacing.sm }}>
            {['All', 'Pending', 'Approved', 'Rejected'].map(filter => (
              <button
                key={filter}
                onClick={() => setCurrentFilter(filter)}
                style={{
                  padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
                  borderRadius: DESIGN_SYSTEM.borderRadius.base,
                  border: currentFilter === filter 
                    ? `2px solid ${DESIGN_SYSTEM.colors.primary[500]}`
                    : `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`,
                  backgroundColor: currentFilter === filter 
                    ? DESIGN_SYSTEM.colors.primary[50]
                    : DESIGN_SYSTEM.colors.background.primary,
                  color: currentFilter === filter 
                    ? DESIGN_SYSTEM.colors.primary[700]
                    : DESIGN_SYSTEM.colors.text.secondary,
                  fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                  fontWeight: currentFilter === filter 
                    ? DESIGN_SYSTEM.typography.fontWeight.medium
                    : DESIGN_SYSTEM.typography.fontWeight.normal,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {filter} ({filter === 'All' 
                  ? allRequests.length 
                  : allRequests.filter(r => r.status?.toLowerCase() === filter.toLowerCase()).length
                })
              </button>
            ))}
          </div>

          {/* Search */}
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
              minWidth: '250px'
            }}
          />
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
            gridTemplateColumns: '1fr 200px 150px 150px 150px 120px',
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
            currentRequests.map(request => (
              <div key={request.id}>
                {/* Main Row */}
                <div
                  onClick={() => handleRowClick(request.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 150px 150px 150px 120px',
                    gap: DESIGN_SYSTEM.spacing.sm,
                    padding: DESIGN_SYSTEM.spacing.base,
                    borderBottom: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: expandedRow === request.id 
                      ? DESIGN_SYSTEM.colors.primary[25]
                      : 'transparent'
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
                  <div style={{
                    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                    color: DESIGN_SYSTEM.colors.text.primary,
                    fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium
                  }}>
                    {request.requestTitle}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: DESIGN_SYSTEM.spacing.xs }}>
                    {getRequestTypeBadge(request.requestType)}
                    <button
                      onClick={(e) => handleEntityClick(request, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: DESIGN_SYSTEM.colors.primary[600],
                        fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0
                      }}
                    >
                      {request.entityName}
                    </button>
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
                  
                  <div>
                    {getStatusBadge(request.status)}
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

                        {/* Attached Files */}
                        {request.attachedFiles?.length > 0 && (
                          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.base }}>
                            <h4 style={{
                              margin: `0 0 ${DESIGN_SYSTEM.spacing.xs} 0`,
                              fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
                              fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
                              color: DESIGN_SYSTEM.colors.text.primary
                            }}>
                              Attached Files
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: DESIGN_SYSTEM.spacing.xs }}>
                              {request.attachedFiles.map((fileUrl, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    console.log('Downloading attached file:', fileUrl, request.attachedFileNames?.[index]);
                                    downloadFile(fileUrl, request.attachedFileNames?.[index]);
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
                                  📎 {request.attachedFileNames?.[index] || `File ${index + 1}`}
                                </button>
                              ))}
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
                        
                        {/* Delete button for request owner */}
                        {request.requestedBy === currentUser?.uid && (
                          <div style={{ marginBottom: DESIGN_SYSTEM.spacing.sm }}>
                            <button
                              onClick={(e) => openDeleteModal(request, e)}
                              style={{
                                width: "100%",
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
                              🗑️ Delete Request
                            </button>
                          </div>
                        )}
                        
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
                              ✓ Approve
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
                              ✗ Reject
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
    </div>
  );
}
