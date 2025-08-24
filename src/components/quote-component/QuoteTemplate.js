import React, { useState, useEffect } from 'react';
import { COLORS, BUTTON_STYLES, INPUT_STYLES } from '../profile-component/constants';

export default function QuoteTemplate({ 
  initialQuoteData = {}, 
  onSave, 
  onSaveAsDraft,
  onCancel,
  readOnly = false,
  customerData = null,
  projectData = null,
  availableProjects = [],
  availableCustomers = []
}) {
  const defaultQuoteData = {
    quoteNumber: '', // Will be set in useEffect for new quotes
    date: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerInfo: {
      name: customerData?.customerProfile?.name || '',
      email: customerData?.customerProfile?.email || '',
      phone: customerData?.customerProfile?.phone || '',
      company: customerData?.companyProfile?.company || '',
      address: ''
    },
    projectInfo: {
      name: projectData?.name || '',
      description: projectData?.description || '',
      startDate: '',
      estimatedEndDate: ''
    },
    items: [
      { id: 1, description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }
    ],
    subtotal: 0,
    taxRate: 7, // Default tax rate (%)
    taxAmount: 0,
    total: 0,
    notes: 'Payment terms: 50% upfront, 50% upon completion.',
    terms: 'This quote is valid for 30 days from the date of issue.',
    status: 'draft' // draft, sent, accepted, rejected
  };

  const [quoteData, setQuoteData] = useState({...defaultQuoteData, ...initialQuoteData});
  const [editingItem, setEditingItem] = useState(null);
  const [errors, setErrors] = useState({});
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isCustomerSectionCollapsed, setIsCustomerSectionCollapsed] = useState(false);
  const [isProjectSectionCollapsed, setIsProjectSectionCollapsed] = useState(false);
  const [additionalCustomers, setAdditionalCustomers] = useState([]);
  const [additionalProjects, setAdditionalProjects] = useState([]);
  const [customerProjectMap, setCustomerProjectMap] = useState({});
  
  // Generate a stable quote number for new quotes
  const [generatedQuoteNumber] = useState(generateQuoteNumber());

  // Generate a quote number (YYYY-MM-XXXX format)
  function generateQuoteNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Use timestamp-based number instead of random
    return `${year}-${month}-${day}${hours}${minutes}`;
  }

  // Calculate totals
  const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
      return sum + lineTotal;
    }, 0);
    
    const taxAmount = subtotal * (quoteData.taxRate / 100);
    const total = subtotal + taxAmount;
    
    return { subtotal, taxAmount, total };
  };

  // Handle changes to quote header information
  const handleQuoteInfoChange = (e) => {
    const { name, value } = e.target;
    setQuoteData({
      ...quoteData,
      [name]: value
    });
  };

  // Handle changes to customer information
  const handleCustomerInfoChange = (e) => {
    const { name, value } = e.target;
    setQuoteData({
      ...quoteData,
      customerInfo: {
        ...quoteData.customerInfo,
        [name]: value
      }
    });
  };

  // Handle changes to project information
  const handleProjectInfoChange = (e) => {
    const { name, value } = e.target;
    setQuoteData({
      ...quoteData,
      projectInfo: {
        ...quoteData.projectInfo,
        [name]: value
      }
    });
  };

  // Handle changes to line items
  const handleItemChange = (id, field, value) => {
    const updatedItems = quoteData.items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate line total
        if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
          const lineTotal = updatedItem.quantity * updatedItem.unitPrice * (1 - updatedItem.discount / 100);
          updatedItem.total = parseFloat(lineTotal.toFixed(2));
        }
        
        return updatedItem;
      }
      return item;
    });
    
    const { subtotal, taxAmount, total } = calculateTotals(updatedItems);
    
    setQuoteData({
      ...quoteData,
      items: updatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });
  };

  // Add a new line item
  const addItem = () => {
    const newId = Math.max(...quoteData.items.map(item => item.id), 0) + 1;
    const newItem = { id: newId, description: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 };
    
    const updatedItems = [...quoteData.items, newItem];
    setQuoteData({
      ...quoteData,
      items: updatedItems
    });
  };

  // Remove a line item
  const removeItem = (id) => {
    if (quoteData.items.length <= 1) {
      alert("You must have at least one item in the quote.");
      return;
    }
    
    const updatedItems = quoteData.items.filter(item => item.id !== id);
    const { subtotal, taxAmount, total } = calculateTotals(updatedItems);
    
    setQuoteData({
      ...quoteData,
      items: updatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });
  };

  // Handle tax rate change
  const handleTaxRateChange = (e) => {
    const taxRate = parseFloat(e.target.value) || 0;
    const taxAmount = quoteData.subtotal * (taxRate / 100);
    const total = quoteData.subtotal + taxAmount;
    
    setQuoteData({
      ...quoteData,
      taxRate,
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    });
  };

  // Reset form when creating a new quote or editing an existing one
  useEffect(() => {
    // If initialQuoteData is empty or undefined, reset to default (new quote)
    if (!initialQuoteData || Object.keys(initialQuoteData).length === 0) {
      // Use the pre-generated quote number that won't change on re-renders
      const freshDefaultData = {
        ...defaultQuoteData,
        quoteNumber: generatedQuoteNumber,
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
      
      setQuoteData(freshDefaultData);
      setAdditionalCustomers([]);
      setAdditionalProjects([]);
      setCustomerProjectMap({});
      setErrors({});
      setSelectedCustomerId('');
      setSelectedProjectId('');
    } else {
      // Editing an existing quote
      setQuoteData({...defaultQuoteData, ...initialQuoteData});
      
      // Load additional customers and projects if they exist in initialQuoteData
      if (initialQuoteData.additionalCustomers) {
        setAdditionalCustomers(initialQuoteData.additionalCustomers);
      } else {
        setAdditionalCustomers([]);
      }
      
      if (initialQuoteData.additionalProjects) {
        setAdditionalProjects(initialQuoteData.additionalProjects);
      } else {
        setAdditionalProjects([]);
      }
      
      if (initialQuoteData.customerProjectMap) {
        setCustomerProjectMap(initialQuoteData.customerProjectMap);
      } else {
        setCustomerProjectMap({});
      }
      
      // Set selected IDs if available
      if (initialQuoteData?.customerInfo?.id) {
        setSelectedCustomerId(initialQuoteData.customerInfo.id);
      } else {
        setSelectedCustomerId('');
      }
      
      if (initialQuoteData?.projectInfo?.id) {
        setSelectedProjectId(initialQuoteData.projectInfo.id);
      } else {
        setSelectedProjectId('');
      }
    }
    
    // Always reset editing item state
    setEditingItem(null);
  }, [initialQuoteData, defaultQuoteData]);

  // Validate form
  const validateForm = (status = 'submitted') => {
    const newErrors = {};
    
    // Only validate fully if not saving as draft
    if (status !== 'draft') {
      if (!quoteData.customerInfo.name) {
        newErrors.customerName = 'Customer name is required';
      }
      
      if (!quoteData.projectInfo.name) {
        newErrors.projectName = 'Project name is required';
      }
      
      if (quoteData.items.length === 0) {
        newErrors.items = 'At least one item is required';
      } else {
        const invalidItems = quoteData.items.filter(item => !item.description || item.quantity <= 0);
        if (invalidItems.length > 0) {
          newErrors.items = 'All items must have a description and valid quantity';
        }
      }
      
      // Validate start date not earlier than today
      if (quoteData.projectInfo.startDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(quoteData.projectInfo.startDate);
        if (startDate < today) {
          newErrors.startDate = 'Start date cannot be earlier than today';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (validateForm('submitted') && onSave) {
      // Include additional customers, projects, and their mapping in the saved data
      onSave({
        ...quoteData, 
        status: 'sent',
        additionalCustomers,
        additionalProjects,
        customerProjectMap
      });
    }
  };
  
  // Handle save as draft
  const handleSaveAsDraft = () => {
    if (onSaveAsDraft) {
      // Include additional customers, projects, and their mapping in the saved data
      onSaveAsDraft({
        ...quoteData, 
        status: 'draft',
        additionalCustomers,
        additionalProjects,
        customerProjectMap
      });
    }
  };
  
  // Handle customer selection
  const handleCustomerSelect = (e) => {
    const customerId = e.target.value;
    setSelectedCustomerId(customerId);
    
    if (customerId) {
      const selectedCustomer = availableCustomers.find(c => c.id === customerId);
      if (selectedCustomer) {
        setQuoteData({
          ...quoteData,
          customerInfo: {
            id: selectedCustomer.id,
            name: selectedCustomer.customerProfile?.name || '',
            email: selectedCustomer.customerProfile?.email || '',
            phone: selectedCustomer.customerProfile?.phone || '',
            company: selectedCustomer.companyProfile?.company || '',
            address: ''
          }
        });
      }
    }
  };
  
  // Add an additional customer to the quote
  const addAdditionalCustomer = () => {
    if (selectedCustomerId) {
      const selectedCustomer = availableCustomers.find(c => c.id === selectedCustomerId);
      if (selectedCustomer) {
        const customerInfo = {
          id: selectedCustomer.id,
          name: selectedCustomer.customerProfile?.name || '',
          email: selectedCustomer.customerProfile?.email || '',
          phone: selectedCustomer.customerProfile?.phone || '',
          company: selectedCustomer.companyProfile?.company || '',
          address: ''
        };
        
        // Check if customer is already added
        if (!additionalCustomers.some(c => c.id === customerInfo.id) && 
            quoteData.customerInfo.id !== customerInfo.id) {
          setAdditionalCustomers([...additionalCustomers, customerInfo]);
          
          // Clear the selection to allow adding more customers
          setSelectedCustomerId('');
        } else {
          // Show an error if customer is already added
          alert('This customer is already included in the quote.');
        }
      }
    } else {
      // If no customer is selected from dropdown, add a blank customer entry
      const newCustomerId = 'new-customer-' + Date.now();
      const newCustomer = {
        id: newCustomerId,
        name: '',
        email: '',
        phone: '',
        company: '',
        address: ''
      };
      
      setAdditionalCustomers([...additionalCustomers, newCustomer]);
    }
  };
  
  // Remove an additional customer
  const removeAdditionalCustomer = (customerId) => {
    // Remove the customer from additionalCustomers
    setAdditionalCustomers(additionalCustomers.filter(c => c.id !== customerId));
    
    // Get associated project IDs for this customer
    const associatedProjectIds = customerProjectMap[customerId] || [];
    
    // Remove associated projects
    if (associatedProjectIds.length > 0) {
      setAdditionalProjects(additionalProjects.filter(p => !associatedProjectIds.includes(p.id)));
      
      // Remove associated items
      setQuoteData({
        ...quoteData,
        items: quoteData.items.filter(item => !associatedProjectIds.includes(item.projectId))
      });
    }
    
    // Remove customer from the mapping
    const updatedMap = {...customerProjectMap};
    delete updatedMap[customerId];
    setCustomerProjectMap(updatedMap);
  };
  
  // Toggle customer section collapse
  const toggleCustomerSection = () => {
    setIsCustomerSectionCollapsed(!isCustomerSectionCollapsed);
  };
  
  // Handle project selection
  const handleProjectSelect = (e) => {
    const projectId = e.target.value;
    setSelectedProjectId(projectId);
    
    if (projectId) {
      const selectedProject = availableProjects.find(p => p.id === projectId);
      if (selectedProject) {
        // Get today's date for start date if not already set
        const today = new Date().toISOString().split('T')[0];
        
        // Calculate a default estimated end date (3 months from today) if not provided
        const defaultEndDate = new Date();
        defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
        const formattedEndDate = defaultEndDate.toISOString().split('T')[0];
        
        // Auto-fill project information
        setQuoteData({
          ...quoteData,
          projectInfo: {
            id: selectedProject.id,
            name: selectedProject.name || '',
            description: selectedProject.description || '',
            startDate: today,
            estimatedEndDate: selectedProject.deadline || formattedEndDate
          },
          // If the project has a budget or pricing information, add it as an item
          items: selectedProject.budget ? [
            ...quoteData.items,
            {
              id: Math.max(...quoteData.items.map(item => item.id), 0) + 1,
              description: `${selectedProject.name} - Project Fee`,
              quantity: 1,
              unitPrice: parseFloat(selectedProject.budget) || 0,
              discount: 0,
              total: parseFloat(selectedProject.budget) || 0
            }
          ] : quoteData.items
        });
        
        // Clear any project-related errors
        setErrors(prev => ({
          ...prev,
          projectName: undefined,
          startDate: undefined
        }));
      }
    }
  };
  
  // Add an additional project to the quote
  const addAdditionalProject = (customerId = null) => {
    if (selectedProjectId) {
      const selectedProject = availableProjects.find(p => p.id === selectedProjectId);
      if (selectedProject) {
        // Get today's date for start date if not already set
        const today = new Date().toISOString().split('T')[0];
        
        // Calculate a default estimated end date (3 months from today) if not provided
        const defaultEndDate = new Date();
        defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
        const formattedEndDate = defaultEndDate.toISOString().split('T')[0];
        
        const projectInfo = {
          id: selectedProject.id,
          name: selectedProject.name || '',
          description: selectedProject.description || '',
          startDate: today,
          estimatedEndDate: selectedProject.deadline || formattedEndDate,
          // Store the associated customer ID if provided
          customerId: customerId || quoteData.customerInfo.id || null
        };
        
        // Check if project is already added
        const isAlreadyAdded = additionalProjects.some(p => p.id === projectInfo.id) ||
                              (quoteData.projectInfo && quoteData.projectInfo.id === projectInfo.id);
                              
        if (!isAlreadyAdded) {
          const updatedProjects = [...additionalProjects, projectInfo];
          setAdditionalProjects(updatedProjects);
          
          // Update the customer-project mapping
          const updatedMap = {...customerProjectMap};
          const customerKey = customerId || quoteData.customerInfo.id || 'main';
          
          if (!updatedMap[customerKey]) {
            updatedMap[customerKey] = [];
          }
          
          updatedMap[customerKey].push(projectInfo.id);
          setCustomerProjectMap(updatedMap);
          
          // If the project has a budget, add it as an item
          if (selectedProject.budget) {
            const customerName = customerId ? 
              additionalCustomers.find(c => c.id === customerId)?.name || 'Additional Customer' : 
              quoteData.customerInfo.name || 'Main Customer';
              
            const newItem = {
              id: Math.max(...quoteData.items.map(item => item.id), 0) + 1,
              description: `${selectedProject.name} - Project Fee (${customerName})`,
              quantity: 1,
              unitPrice: parseFloat(selectedProject.budget) || 0,
              discount: 0,
              total: parseFloat(selectedProject.budget) || 0,
              projectId: projectInfo.id,
              customerId: customerKey
            };
            
            setQuoteData({
              ...quoteData,
              items: [...quoteData.items, newItem]
            });
          }
          
          // Clear the selection to allow adding more projects
          setSelectedProjectId('');
        } else {
          // Show an error if project is already added
          alert('This project is already included in the quote.');
        }
      }
    } else {
      // If no project is selected from dropdown, add a blank project entry
      const newProjectId = 'new-project-' + Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      // Calculate a default estimated end date (3 months from today)
      const defaultEndDate = new Date();
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
      const formattedEndDate = defaultEndDate.toISOString().split('T')[0];
      
      const newProject = {
        id: newProjectId,
        name: '',
        description: '',
        startDate: today,
        estimatedEndDate: formattedEndDate,
        customerId: customerId || quoteData.customerInfo.id || null
      };
      
      const updatedProjects = [...additionalProjects, newProject];
      setAdditionalProjects(updatedProjects);
      
      // Update the customer-project mapping
      const updatedMap = {...customerProjectMap};
      const customerKey = customerId || quoteData.customerInfo.id || 'main';
      
      if (!updatedMap[customerKey]) {
        updatedMap[customerKey] = [];
      }
      
      updatedMap[customerKey].push(newProjectId);
      setCustomerProjectMap(updatedMap);
    }
  };
  
  // Remove an additional project
  const removeAdditionalProject = (projectId) => {
    // Find the project to be removed
    const projectToRemove = additionalProjects.find(p => p.id === projectId);
    
    if (projectToRemove) {
      // Remove the project from additionalProjects
      setAdditionalProjects(additionalProjects.filter(p => p.id !== projectId));
      
      // Update the customer-project mapping
      const updatedMap = {...customerProjectMap};
      const customerKey = projectToRemove.customerId || 'main';
      
      if (updatedMap[customerKey]) {
        updatedMap[customerKey] = updatedMap[customerKey].filter(id => id !== projectId);
        
        // If there are no more projects for this customer, remove the entry
        if (updatedMap[customerKey].length === 0) {
          delete updatedMap[customerKey];
        }
      }
      
      setCustomerProjectMap(updatedMap);
      
      // Also remove any quote items associated with this project
      setQuoteData({
        ...quoteData,
        items: quoteData.items.filter(item => item.projectId !== projectId)
      });
    }
  };
  
  // Toggle project section collapse
  const toggleProjectSection = () => {
    setIsProjectSectionCollapsed(!isProjectSectionCollapsed);
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      color: COLORS.text,
      background: COLORS.cardBackground,
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      padding: '30px',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      {/* Quote Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '30px',
        borderBottom: `1px solid ${COLORS.lightBorder}`,
        paddingBottom: '20px'
      }}>
        <div>
          <h1 style={{ color: COLORS.primary, marginBottom: '5px' }}>QUOTATION</h1>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '14px', color: COLORS.lightText }}>Quote #</label>
              <input
                type="text"
                name="quoteNumber"
                value={quoteData.quoteNumber}
                onChange={handleQuoteInfoChange}
                disabled={readOnly}
                style={{ ...INPUT_STYLES.base, width: '150px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', color: COLORS.lightText }}>Date</label>
              <input
                type="date"
                name="date"
                value={quoteData.date}
                onChange={handleQuoteInfoChange}
                disabled={readOnly}
                style={{ ...INPUT_STYLES.base, width: '150px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '14px', color: COLORS.lightText }}>Valid Until</label>
              <input
                type="date"
                name="validUntil"
                value={quoteData.validUntil}
                onChange={handleQuoteInfoChange}
                disabled={readOnly}
                style={{ ...INPUT_STYLES.base, width: '150px' }}
              />
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ color: COLORS.dark, marginBottom: '5px' }}>ProFlow</h2>
          <p style={{ margin: '0', fontSize: '14px' }}>Your Company Address</p>
          <p style={{ margin: '0', fontSize: '14px' }}>City, State ZIP</p>
          <p style={{ margin: '0', fontSize: '14px' }}>Phone: (123) 456-7890</p>
          <p style={{ margin: '0', fontSize: '14px' }}>Email: contact@proflow.com</p>
        </div>
      </div>

      {/* Customer & Project Information */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '30px',
        marginBottom: '30px'
      }}>
        {/* Customer Information */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px',
            cursor: 'pointer'
          }}
          onClick={toggleCustomerSection}
          >
            <h3 style={{ color: COLORS.dark, margin: 0 }}>
              Customer Information
            </h3>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: COLORS.primary
              }}
            >
              {isCustomerSectionCollapsed ? '▼' : '▲'}
            </button>
          </div>
          
          {!isCustomerSectionCollapsed && (
            <>
              {!readOnly && (
                <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {availableCustomers.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '14px', color: COLORS.lightText, display: 'block', marginBottom: '5px' }}>
                          Select Customer
                        </label>
                        <select
                          value={selectedCustomerId}
                          onChange={handleCustomerSelect}
                          style={{
                            ...INPUT_STYLES.base,
                            width: '100%',
                            height: '38px'
                          }}
                        >
                          <option value="">-- Select a customer --</option>
                          <optgroup label="Active Customers">
                            {availableCustomers
                              .filter(c => c.status !== 'Inactive')
                              .map(customer => (
                                <option key={customer.id} value={customer.id}>
                                  {customer.customerProfile?.name || 'Unnamed'} - {customer.companyProfile?.company || 'No company'}
                                </option>
                              ))}
                          </optgroup>
                          {availableCustomers.some(c => c.status === 'Inactive') && (
                            <optgroup label="Inactive Customers">
                              {availableCustomers
                                .filter(c => c.status === 'Inactive')
                                .map(customer => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.customerProfile?.name || 'Unnamed'} - {customer.companyProfile?.company || 'No company'}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addAdditionalCustomer();
                          }}
                          style={{
                            ...BUTTON_STYLES.secondary,
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Add Customer
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => addAdditionalCustomer()}
                      style={{
                        background: 'transparent',
                        border: `1px dashed ${COLORS.primary}`,
                        color: COLORS.primary,
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>+</span> Add Custom Customer
                    </button>
                    
                    {availableCustomers.length > 0 && (
                      <div style={{ fontSize: '13px', color: COLORS.lightText }}>
                        {availableCustomers.length} customer(s) available
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  fontSize: '14px', 
                  color: COLORS.lightText, 
                  display: 'block', 
                  marginBottom: '5px' 
                }}>
                  Name <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={quoteData.customerInfo.name}
                  onChange={handleCustomerInfoChange}
                  disabled={readOnly}
                  style={{
                    ...INPUT_STYLES.base,
                    width: '100%',
                    borderColor: errors.customerName ? COLORS.danger : INPUT_STYLES.base.borderColor
                  }}
                />
                {errors.customerName && (
                  <p style={{ color: COLORS.danger, fontSize: '12px', margin: '5px 0 0' }}>
                    {errors.customerName}
                  </p>
                )}
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  fontSize: '14px', 
                  color: COLORS.lightText, 
                  display: 'block', 
                  marginBottom: '5px' 
                }}>
                  Company
                </label>
                <input
                  type="text"
                  name="company"
                  value={quoteData.customerInfo.company}
                  onChange={handleCustomerInfoChange}
                  disabled={readOnly}
                  style={{
                    ...INPUT_STYLES.base,
                    width: '100%'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: COLORS.lightText, 
                    display: 'block', 
                    marginBottom: '5px' 
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={quoteData.customerInfo.email}
                    onChange={handleCustomerInfoChange}
                    disabled={readOnly}
                    style={{
                      ...INPUT_STYLES.base,
                      width: '100%'
                    }}
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: COLORS.lightText, 
                    display: 'block', 
                    marginBottom: '5px' 
                  }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={quoteData.customerInfo.phone}
                    onChange={handleCustomerInfoChange}
                    disabled={readOnly}
                    style={{
                      ...INPUT_STYLES.base,
                      width: '100%'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  fontSize: '14px', 
                  color: COLORS.lightText, 
                  display: 'block', 
                  marginBottom: '5px' 
                }}>
                  Address
                </label>
                <textarea
                  name="address"
                  value={quoteData.customerInfo.address}
                  onChange={handleCustomerInfoChange}
                  disabled={readOnly}
                  style={{ 
                    ...INPUT_STYLES.base, 
                    width: '100%',
                    minHeight: '60px' 
                  }}
                />
              </div>
              
              {/* Additional Customers */}
              {additionalCustomers.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ color: COLORS.dark, marginBottom: '10px', borderBottom: `1px solid ${COLORS.lightBorder}`, paddingBottom: '5px' }}>
                    Additional Customers
                  </h4>
                  
                  {additionalCustomers.map((customer, index) => (
                    <div 
                      key={customer.id}
                      style={{
                        padding: '10px',
                        backgroundColor: COLORS.light,
                        borderRadius: '5px',
                        marginBottom: '10px',
                        position: 'relative'
                      }}
                    >
                      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
                        {customer.name} {customer.company && `- ${customer.company}`}
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {customer.email && (
                          <div>Email: {customer.email}</div>
                        )}
                        {customer.phone && (
                          <div>Phone: {customer.phone}</div>
                        )}
                      </div>
                      
                      {/* Projects associated with this customer */}
                      {customerProjectMap[customer.id] && customerProjectMap[customer.id].length > 0 && (
                        <div style={{ 
                          marginTop: '8px', 
                          fontSize: '13px',
                          borderTop: `1px dashed ${COLORS.lightBorder}`,
                          paddingTop: '5px'
                        }}>
                          <div style={{ fontWeight: '500', marginBottom: '3px' }}>Associated Projects:</div>
                          <ul style={{ margin: '0', paddingLeft: '20px' }}>
                            {customerProjectMap[customer.id].map(projectId => {
                              const project = additionalProjects.find(p => p.id === projectId);
                              return project ? (
                                <li key={projectId}>{project.name}</li>
                              ) : null;
                            })}
                          </ul>
                        </div>
                      )}
                      
                      {!readOnly && (
                        <div style={{ position: 'absolute', top: '5px', right: '5px', display: 'flex', gap: '5px' }}>
                          {/* Add project button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              setSelectedProjectId('');
                              
                              // Show a prompt to select a project
                              const projectSelect = document.createElement('select');
                              projectSelect.style.position = 'absolute';
                              projectSelect.style.top = '30px';
                              projectSelect.style.right = '5px';
                              projectSelect.style.zIndex = '100';
                              projectSelect.style.padding = '5px';
                              projectSelect.style.borderRadius = '4px';
                              
                              // Add options
                              const defaultOption = document.createElement('option');
                              defaultOption.value = '';
                              defaultOption.text = '-- Select Project --';
                              projectSelect.appendChild(defaultOption);
                              
                              availableProjects.forEach(project => {
                                const option = document.createElement('option');
                                option.value = project.id;
                                option.text = project.name;
                                projectSelect.appendChild(option);
                              });
                              
                              // Handle selection
                              projectSelect.onchange = (event) => {
                                if (event.target.value) {
                                  setSelectedProjectId(event.target.value);
                                  addAdditionalProject(customer.id);
                                  event.target.parentNode.removeChild(event.target);
                                }
                              };
                              
                              // Add to DOM
                              e.currentTarget.parentNode.appendChild(projectSelect);
                            }}
                            style={{
                              background: COLORS.primary,
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '12px',
                              borderRadius: '3px',
                              padding: '2px 5px'
                            }}
                          >
                            + Project
                          </button>
                          
                          {/* Remove customer button */}
                          <button
                            type="button"
                            onClick={() => removeAdditionalCustomer(customer.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: COLORS.danger,
                              cursor: 'pointer',
                              fontSize: '16px',
                              padding: '0',
                              lineHeight: '1'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Project Information */}
        <div style={{ flex: 1 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px',
            cursor: 'pointer'
          }}
          onClick={toggleProjectSection}
          >
            <h3 style={{ color: COLORS.dark, margin: 0 }}>
              Project Information
            </h3>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: COLORS.primary
              }}
            >
              {isProjectSectionCollapsed ? '▼' : '▲'}
            </button>
          </div>
          
          {!isProjectSectionCollapsed && (
            <>
                        {!readOnly && availableProjects.length > 0 && (
            <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', color: COLORS.lightText, display: 'block', marginBottom: '5px' }}>
                    Select Project
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={handleProjectSelect}
                    style={{
                      ...INPUT_STYLES.base,
                      width: '100%',
                      height: '38px'
                    }}
                  >
                    <option value="">-- Select a project --</option>
                    {availableProjects.length > 0 ? (
                      <>
                        {availableProjects.some(p => p.isOwner) && (
                          <optgroup label="Your Projects">
                            {availableProjects.filter(p => p.isOwner).map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name || 'Unnamed Project'}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {availableProjects.some(p => p.isTeamMember) && (
                          <optgroup label="Team Projects">
                            {availableProjects.filter(p => p.isTeamMember).map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name || 'Unnamed Project'}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {availableProjects.some(p => !p.isOwner && !p.isTeamMember) && (
                          <optgroup label="Other Projects">
                            {availableProjects.filter(p => !p.isOwner && !p.isTeamMember).map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name || 'Unnamed Project'}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      <option disabled>No projects available</option>
                    )}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addAdditionalProject();
                    }}
                    style={{
                      ...BUTTON_STYLES.secondary,
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Add Project
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addAdditionalProject(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: `1px dashed ${COLORS.primary}`,
                    color: COLORS.primary,
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>+</span> Add Custom Project
                </button>
                
                <div style={{ fontSize: '13px', color: COLORS.lightText }}>
                  {availableProjects.length} project(s) available
                </div>
              </div>
            </div>
          )}
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  fontSize: '14px', 
                  color: COLORS.lightText, 
                  display: 'block', 
                  marginBottom: '5px' 
                }}>
                  Project Name <span style={{ color: COLORS.danger }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={quoteData.projectInfo.name}
                  onChange={handleProjectInfoChange}
                  disabled={readOnly}
                  style={{
                    ...INPUT_STYLES.base,
                    width: '100%',
                    borderColor: errors.projectName ? COLORS.danger : INPUT_STYLES.base.borderColor
                  }}
                />
                {errors.projectName && (
                  <p style={{ color: COLORS.danger, fontSize: '12px', margin: '5px 0 0' }}>
                    {errors.projectName}
                  </p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: COLORS.lightText, 
                    display: 'block', 
                    marginBottom: '5px' 
                  }}>
                    Start Date <span style={{ color: COLORS.danger }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={quoteData.projectInfo.startDate}
                    onChange={handleProjectInfoChange}
                    disabled={readOnly}
                    style={{
                      ...INPUT_STYLES.base,
                      width: '100%',
                      borderColor: errors.startDate ? COLORS.danger : INPUT_STYLES.base.borderColor
                    }}
                  />
                  {errors.startDate && (
                    <p style={{ color: COLORS.danger, fontSize: '12px', margin: '5px 0 0' }}>
                      {errors.startDate}
                    </p>
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: COLORS.lightText, 
                    display: 'block', 
                    marginBottom: '5px' 
                  }}>
                    Estimated End Date
                  </label>
                  <input
                    type="date"
                    name="estimatedEndDate"
                    value={quoteData.projectInfo.estimatedEndDate}
                    onChange={handleProjectInfoChange}
                    disabled={readOnly}
                    style={{
                      ...INPUT_STYLES.base,
                      width: '100%'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  fontSize: '14px', 
                  color: COLORS.lightText, 
                  display: 'block', 
                  marginBottom: '5px' 
                }}>
                  Project Description
                </label>
                <textarea
                  name="description"
                  value={quoteData.projectInfo.description}
                  onChange={handleProjectInfoChange}
                  disabled={readOnly}
                  style={{ 
                    ...INPUT_STYLES.base, 
                    width: '100%',
                    minHeight: '60px' 
                  }}
                />
              </div>
              
              {/* Additional Projects */}
              {additionalProjects.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ color: COLORS.dark, marginBottom: '10px', borderBottom: `1px solid ${COLORS.lightBorder}`, paddingBottom: '5px' }}>
                    Additional Projects
                  </h4>
                  
                  {additionalProjects.map((project, index) => (
                    <div 
                      key={project.id}
                      style={{
                        padding: '10px',
                        backgroundColor: COLORS.light,
                        borderRadius: '5px',
                        marginBottom: '10px',
                        position: 'relative'
                      }}
                    >
                      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        {/* Show associated customer if available */}
                        {project.customerId && (
                          <div style={{ 
                            backgroundColor: COLORS.primary + '20', 
                            padding: '2px 5px', 
                            borderRadius: '3px',
                            display: 'inline-block',
                            marginBottom: '5px',
                            fontSize: '12px'
                          }}>
                            Customer: {
                              project.customerId === quoteData.customerInfo.id 
                                ? quoteData.customerInfo.name 
                                : additionalCustomers.find(c => c.id === project.customerId)?.name || 'Unknown'
                            }
                          </div>
                        )}
                        
                        <div style={{ marginTop: '3px' }}>
                          {project.startDate && (
                            <div>Start: {new Date(project.startDate).toLocaleDateString()}</div>
                          )}
                          {project.estimatedEndDate && (
                            <div>End: {new Date(project.estimatedEndDate).toLocaleDateString()}</div>
                          )}
                          {project.description && (
                            <div style={{ marginTop: '5px', fontStyle: 'italic' }}>{project.description}</div>
                          )}
                        </div>
                      </div>
                      
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeAdditionalProject(project.id)}
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            background: 'transparent',
                            border: 'none',
                            color: COLORS.danger,
                            cursor: 'pointer',
                            fontSize: '16px'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote Items */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ color: COLORS.dark, marginBottom: '15px' }}>
          Quote Items <span style={{ color: COLORS.danger }}>*</span>
        </h3>
        
        {errors.items && (
          <p style={{ color: COLORS.danger, fontSize: '14px', marginBottom: '10px' }}>
            {errors.items}
          </p>
        )}
        
        <div style={{ 
          border: errors.items ? `1px solid ${COLORS.danger}` : `1px solid ${COLORS.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '15px'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ backgroundColor: COLORS.light }}>
                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>Description</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: '100px' }}>Quantity</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: '120px' }}>Unit Price</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: '100px' }}>Discount %</th>
                <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}`, width: '120px' }}>Total</th>
                <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: `1px solid ${COLORS.border}`, width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quoteData.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.lightBorder}` }}>
                  <td style={{ padding: '12px 15px' }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      disabled={readOnly}
                      style={{ 
                        ...INPUT_STYLES.base, 
                        width: '100%',
                        borderColor: !item.description && errors.items ? COLORS.danger : INPUT_STYLES.base.borderColor
                      }}
                      placeholder="Item description"
                      required
                    />
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      disabled={readOnly}
                      min="1"
                      style={{ 
                        ...INPUT_STYLES.base, 
                        width: '70px', 
                        textAlign: 'center',
                        borderColor: (item.quantity <= 0) && errors.items ? COLORS.danger : INPUT_STYLES.base.borderColor
                      }}
                      required
                    />
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      disabled={readOnly}
                      min="0"
                      step="0.01"
                      style={{ ...INPUT_STYLES.base, width: '90px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={item.discount}
                      onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)}
                      disabled={readOnly}
                      min="0"
                      max="100"
                      style={{ ...INPUT_STYLES.base, width: '70px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold' }}>
                    ${item.total.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                    {!readOnly && (
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{
                          background: COLORS.danger,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              
              {quoteData.items.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: COLORS.lightText }}>
                    No items added yet. Click "Add Item" to add your first item.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {!readOnly && (
          <button
            onClick={addItem}
            style={{
              ...BUTTON_STYLES.secondary,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '14px',
              padding: '8px 15px'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Add Item
          </button>
        )}

        {/* Totals */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <div style={{ width: '300px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: `1px solid ${COLORS.lightBorder}`
            }}>
              <span>Subtotal:</span>
              <span>${quoteData.subtotal.toFixed(2)}</span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: `1px solid ${COLORS.lightBorder}`
            }}>
              <span>Tax Rate:</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  value={quoteData.taxRate}
                  onChange={handleTaxRateChange}
                  disabled={readOnly}
                  min="0"
                  max="100"
                  style={{ ...INPUT_STYLES.base, width: '60px', textAlign: 'right', marginRight: '5px' }}
                />
                <span>%</span>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: `1px solid ${COLORS.lightBorder}`
            }}>
              <span>Tax Amount:</span>
              <span>${quoteData.taxAmount.toFixed(2)}</span>
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: `2px solid ${COLORS.dark}`,
              fontWeight: 'bold',
              fontSize: '18px'
            }}>
              <span>Total:</span>
              <span>${quoteData.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes and Terms */}
      <div style={{
        display: 'flex',
        gap: '30px',
        marginBottom: '30px'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: COLORS.dark, marginBottom: '10px' }}>Notes</h3>
          <textarea
            value={quoteData.notes}
            onChange={(e) => setQuoteData({...quoteData, notes: e.target.value})}
            disabled={readOnly}
            style={{ ...INPUT_STYLES.base, minHeight: '100px', width: '100%' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: COLORS.dark, marginBottom: '10px' }}>Terms & Conditions</h3>
          <textarea
            value={quoteData.terms}
            onChange={(e) => setQuoteData({...quoteData, terms: e.target.value})}
            disabled={readOnly}
            style={{ ...INPUT_STYLES.base, minHeight: '100px', width: '100%' }}
          />
        </div>
      </div>

      {/* Actions */}
      {!readOnly && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '15px',
          marginTop: '30px',
          borderTop: `1px solid ${COLORS.lightBorder}`,
          paddingTop: '20px'
        }}>
          <button
            onClick={onCancel}
            style={{
              ...BUTTON_STYLES.secondary,
              minWidth: '120px',
              padding: '10px 20px'
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSaveAsDraft}
            style={{
              ...BUTTON_STYLES.tertiary,
              minWidth: '120px',
              padding: '10px 20px'
            }}
          >
            Save as Draft
          </button>
          
          <button
            onClick={handleSave}
            style={{
              ...BUTTON_STYLES.primary,
              minWidth: '120px',
              padding: '10px 20px'
            }}
          >
            Save Quote
          </button>
        </div>
      )}
    </div>
  );
}
