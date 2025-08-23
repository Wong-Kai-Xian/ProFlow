import React, { useState } from 'react';
import { COLORS, BUTTON_STYLES } from '../profile-component/constants';

export default function QuoteList({ quotes = [], onViewQuote, onEditQuote, onCreateQuote, onFilterChange }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateSort, setDateSort] = useState('newest');

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onFilterChange) {
      onFilterChange({
        searchTerm: e.target.value,
        statusFilter,
        dateSort
      });
    }
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    if (onFilterChange) {
      onFilterChange({
        searchTerm,
        statusFilter: e.target.value,
        dateSort
      });
    }
  };

  const handleDateSortChange = (e) => {
    setDateSort(e.target.value);
    if (onFilterChange) {
      onFilterChange({
        searchTerm,
        statusFilter,
        dateSort: e.target.value
      });
    }
  };

  const getStatusBadgeStyle = (status) => {
    let backgroundColor;
    let textColor = 'white';
    
    switch (status) {
      case 'draft':
        backgroundColor = COLORS.secondary;
        break;
      case 'sent':
        backgroundColor = COLORS.primary;
        break;
      case 'accepted':
        backgroundColor = COLORS.success;
        break;
      case 'rejected':
        backgroundColor = COLORS.danger;
        break;
      default:
        backgroundColor = COLORS.gray;
    }
    
    return {
      backgroundColor,
      color: textColor,
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      textTransform: 'capitalize'
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      color: COLORS.text
    }}>
      {/* Filters and Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{
          display: 'flex',
          gap: '15px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={handleSearchChange}
              style={{
                padding: '8px 12px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '4px',
                width: '200px'
              }}
            />
          </div>
          
          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              style={{
                padding: '8px 12px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          {/* Date Sort */}
          <div>
            <select
              value={dateSort}
              onChange={handleDateSortChange}
              style={{
                padding: '8px 12px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        
        {/* Create Quote Button */}
        <button
          onClick={onCreateQuote}
          style={BUTTON_STYLES.primary}
        >
          Create New Quote
        </button>
      </div>

      {/* Quotes Table */}
      {quotes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: COLORS.light,
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', color: COLORS.lightText }}>No quotes found. Create your first quote to get started.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px'
          }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.light }}>
                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Quote #</th>
                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Customer</th>
                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Project</th>
                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Date</th>
                <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>Amount</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}` }}>Status</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} style={{ borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                  <td style={{ padding: '12px 15px' }}>{quote.quoteNumber}</td>
                  <td style={{ padding: '12px 15px' }}>{quote.customerInfo.name}</td>
                  <td style={{ padding: '12px 15px' }}>{quote.projectInfo.name}</td>
                  <td style={{ padding: '12px 15px' }}>{new Date(quote.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: '500' }}>
                    {formatCurrency(quote.total)}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    <span style={getStatusBadgeStyle(quote.status)}>
                      {quote.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => onViewQuote(quote.id)}
                        style={{
                          background: COLORS.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        View
                      </button>
                      
                      {onEditQuote && (
                        <button
                          onClick={() => onEditQuote(quote.id)}
                          style={{
                            background: COLORS.success,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
