import React, { useState, useEffect } from 'react';
import { COLORS, BUTTON_STYLES } from '../profile-component/constants';
import QuoteTemplate from './QuoteTemplate';

export default function QuoteModal({ 
  isOpen, 
  onClose, 
  onSave,
  onSaveAsDraft,
  initialQuoteData = null,
  customerData = null,
  projectData = null,
  readOnly = false,
  availableProjects = [],
  availableCustomers = []
}) {
  const [quoteData, setQuoteData] = useState(initialQuoteData || {});
  
  // Update local state when initialQuoteData changes
  useEffect(() => {
    // If initialQuoteData is null, set an empty object to trigger reset in QuoteTemplate
    setQuoteData(initialQuoteData || {});
  }, [initialQuoteData]);
  
  if (!isOpen) return null;
  
  const handleSave = (updatedQuoteData) => {
    if (onSave) {
      onSave(updatedQuoteData);
    }
  };
  
  const handleSaveAsDraft = (updatedQuoteData) => {
    if (onSaveAsDraft) {
      onSaveAsDraft(updatedQuoteData);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      overflow: 'auto',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '95%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: COLORS.secondary,
            zIndex: 10
          }}
        >
          &times;
        </button>
        
        <div style={{ padding: '20px' }}>
          <QuoteTemplate
            initialQuoteData={quoteData}
            onSave={handleSave}
            onSaveAsDraft={handleSaveAsDraft}
            onCancel={onClose}
            readOnly={readOnly}
            customerData={customerData}
            projectData={projectData}
            availableProjects={availableProjects}
            availableCustomers={availableCustomers}
          />
        </div>
        
        {readOnly && (
          <div style={{
            padding: '15px 20px',
            borderTop: `1px solid ${COLORS.lightBorder}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              onClick={onClose}
              style={{
                ...BUTTON_STYLES.secondary,
                minWidth: '120px',
                padding: '10px 20px'
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
