import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { COLORS } from '../components/profile-component/constants';
import { useAuth } from '../contexts/AuthContext';
import QuoteList from '../components/quote-component/QuoteList';
import QuoteModal from '../components/quote-component/QuoteModal';
import { 
  createQuote, 
  updateQuote,
  getQuotesByUserId,
  filterQuotes 
} from '../services/quoteService';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

export default function Quote() {
  const { currentUser } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [filteredQuotes, setFilteredQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  // Fetch quotes, customers, and projects when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch quotes from Firebase - wrap in try/catch to handle separately
        try {
          const userQuotes = await getQuotesByUserId(currentUser.uid);
          setQuotes(userQuotes);
          setFilteredQuotes(userQuotes);
        } catch (quoteErr) {
          console.error('Error fetching quotes:', quoteErr);
          // Don't set error yet, continue with other fetches
          // Initialize with empty arrays instead of failing
          setQuotes([]);
          setFilteredQuotes([]);
        }
        
        // Fetch customers - wrap in try/catch to handle separately
        try {
          const customerQuery = query(
            collection(db, 'customerProfiles'),
            where('userId', '==', currentUser.uid)
          );
          const customerSnapshot = await getDocs(customerQuery);
          const customerList = [];
          customerSnapshot.forEach(doc => {
            customerList.push({ id: doc.id, ...doc.data() });
          });
          setCustomers(customerList);
        } catch (customerErr) {
          console.error('Error fetching customers:', customerErr);
          setCustomers([]);
        }

        // Fetch projects - wrap in try/catch to handle separately
        try {
          const projectList = [];
          
          // First, try to get all projects
          try {
            const allProjectsQuery = query(
              collection(db, 'projects')
            );
            const allProjectsSnapshot = await getDocs(allProjectsQuery);
            
            allProjectsSnapshot.forEach(doc => {
              const projectData = doc.data();
              const isOwner = projectData.createdBy === currentUser.uid;
              
              projectList.push({ 
                id: doc.id, 
                ...projectData,
                isOwner: isOwner,
                isTeamMember: false // Will be updated later if needed
              });
            });
          } catch (err) {
            console.error('Error fetching all projects:', err);
            
            // Fallback: Try to get only user's projects
            try {
              const ownedProjectQuery = query(
                collection(db, 'projects'),
                where('createdBy', '==', currentUser.uid)
              );
              const ownedProjectSnapshot = await getDocs(ownedProjectQuery);
              
              ownedProjectSnapshot.forEach(doc => {
                projectList.push({ 
                  id: doc.id, 
                  ...doc.data(),
                  isOwner: true,
                  isTeamMember: false
                });
              });
            } catch (ownedErr) {
              console.error('Error fetching owned projects:', ownedErr);
            }
          }
          
          // Then, get projects where the user is a team member
          try {
            const acceptedTeamQuery = query(
              collection(db, 'projectTeamMembers'),
              where('userId', '==', currentUser.uid),
              where('status', '==', 'accepted')
            );
            
            const acceptedTeamSnapshot = await getDocs(acceptedTeamQuery);
            
            acceptedTeamSnapshot.forEach(teamDoc => {
              const teamData = teamDoc.data();
              if (teamData.projectId) {
                // Find the project in our list and mark as team member
                const projectIndex = projectList.findIndex(p => p.id === teamData.projectId);
                if (projectIndex >= 0) {
                  projectList[projectIndex].isTeamMember = true;
                } else {
                  // Try to fetch the project if not already in list
                  getDoc(doc(db, 'projects', teamData.projectId))
                    .then(projectDoc => {
                      if (projectDoc.exists()) {
                        const projectData = projectDoc.data();
                        projectList.push({
                          id: teamData.projectId,
                          ...projectData,
                          isOwner: false,
                          isTeamMember: true
                        });
                        setProjects([...projectList]); // Update state with new project
                      }
                    })
                    .catch(err => console.error(`Error fetching project ${teamData.projectId}:`, err));
                }
              }
            });
          } catch (teamErr) {
            console.error('Error fetching team memberships:', teamErr);
          }
          
          console.log('Projects loaded:', projectList.length);
          setProjects(projectList);
        } catch (projectErr) {
          console.error('Error in overall project fetching:', projectErr);
          setProjects([]);
        }

        // Clear any previous errors since we've handled individual failures gracefully
        setError(null);
      } catch (err) {
        console.error('Error in overall data fetching:', err);
        setError('Failed to load quotes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);



  // Handle filter changes
  const handleFilterChange = (filters) => {
    const filtered = filterQuotes(quotes, filters);
    setFilteredQuotes(filtered);
  };

  // Handle creating a new quote
  const handleCreateQuote = () => {
    setCurrentQuote(null);
    setSelectedCustomer(null);
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  // Handle customer selection for new quote
  const handleCustomerSelect = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
  };

  // Handle project selection for new quote
  const handleProjectSelect = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(project);
  };

  // Handle viewing a quote
  const handleViewQuote = async (quoteId) => {
    try {
      const quote = quotes.find(q => q.id === quoteId);
      
      if (quote) {
        setCurrentQuote(quote);
        
        // Find associated customer and project if they exist
        if (quote.customerInfo && quote.customerInfo.id) {
          const customer = customers.find(c => c.id === quote.customerInfo.id);
          setSelectedCustomer(customer || null);
        }
        
        if (quote.projectInfo && quote.projectInfo.id) {
          const project = projects.find(p => p.id === quote.projectInfo.id);
          setSelectedProject(project || null);
        }
        
        setIsViewModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching quote details:', err);
      alert('Failed to load quote details. Please try again.');
    }
  };
  
  // Handle editing a quote
  const handleEditQuote = async (quoteId) => {
    try {
      const quote = quotes.find(q => q.id === quoteId);
      
      if (quote) {
        setCurrentQuote(quote);
        
        // Find associated customer and project if they exist
        if (quote.customerInfo && quote.customerInfo.id) {
          const customer = customers.find(c => c.id === quote.customerInfo.id);
          setSelectedCustomer(customer || null);
        }
        
        if (quote.projectInfo && quote.projectInfo.id) {
          const project = projects.find(p => p.id === quote.projectInfo.id);
          setSelectedProject(project || null);
        }
        
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching quote details for editing:', err);
      alert('Failed to load quote for editing. Please try again.');
    }
  };

  // Handle saving a quote
  const handleSaveQuote = async (quoteData) => {
    try {
      setLoading(true);
      
      let savedQuote;
      if (currentQuote) {
        // Update existing quote
        savedQuote = await updateQuote(currentQuote.id, {
          ...quoteData,
          userId: currentUser.uid
        });
        
        // Update quotes state
        setQuotes(prevQuotes => 
          prevQuotes.map(q => q.id === savedQuote.id ? savedQuote : q)
        );
        setFilteredQuotes(prevQuotes => 
          prevQuotes.map(q => q.id === savedQuote.id ? savedQuote : q)
        );
      } else {
        // Create new quote
        savedQuote = await createQuote({
          ...quoteData,
          userId: currentUser.uid
        });
        
        // Update quotes state
        setQuotes(prevQuotes => [...prevQuotes, savedQuote]);
        setFilteredQuotes(prevQuotes => [...prevQuotes, savedQuote]);
      }
      
      setIsModalOpen(false);
      setCurrentQuote(null);
    } catch (err) {
      console.error('Error saving quote:', err);
      alert('Failed to save quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle saving a quote as draft
  const handleSaveQuoteAsDraft = async (quoteData) => {
    try {
      setLoading(true);
      
      let savedQuote;
      if (currentQuote) {
        // Update existing quote
        savedQuote = await updateQuote(currentQuote.id, {
          ...quoteData,
          userId: currentUser.uid,
          status: 'draft'
        });
        
        // Update quotes state
        setQuotes(prevQuotes => 
          prevQuotes.map(q => q.id === savedQuote.id ? savedQuote : q)
        );
        setFilteredQuotes(prevQuotes => 
          prevQuotes.map(q => q.id === savedQuote.id ? savedQuote : q)
        );
      } else {
        // Create new quote
        savedQuote = await createQuote({
          ...quoteData,
          userId: currentUser.uid,
          status: 'draft'
        });
        
        // Update quotes state
        setQuotes(prevQuotes => [...prevQuotes, savedQuote]);
        setFilteredQuotes(prevQuotes => [...prevQuotes, savedQuote]);
      }
      
      setIsModalOpen(false);
      setCurrentQuote(null);
    } catch (err) {
      console.error('Error saving quote as draft:', err);
      alert('Failed to save quote as draft. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "Arial, sans-serif",
      background: COLORS.background,
      minHeight: "100vh"
    }}>
      <TopBar />
      <div style={{
        padding: "30px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <h1 style={{ color: COLORS.dark, marginBottom: "30px" }}>My Quotes</h1>

        {!currentUser ? (
          <p style={{ color: COLORS.danger, fontSize: "18px", textAlign: "center" }}>Please log in to view and manage your quotes.</p>
        ) : loading ? (
          <p style={{ textAlign: "center" }}>Loading quotes...</p>
        ) : error ? (
          <p style={{ color: COLORS.danger, textAlign: "center" }}>{error}</p>
        ) : (
          <QuoteList 
            quotes={filteredQuotes}
            onViewQuote={handleViewQuote}
            onEditQuote={handleEditQuote}
            onCreateQuote={handleCreateQuote}
            onFilterChange={handleFilterChange}
          />
        )}
      </div>

      {/* Create/Edit Quote Modal */}
      <QuoteModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCurrentQuote(null);
          setSelectedCustomer(null);
          setSelectedProject(null);
        }}
        onSave={handleSaveQuote}
        onSaveAsDraft={handleSaveQuoteAsDraft}
        initialQuoteData={currentQuote}
        customerData={selectedCustomer}
        projectData={selectedProject}
        availableProjects={projects}
        availableCustomers={customers}
      />

      {/* View Quote Modal */}
      <QuoteModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        initialQuoteData={currentQuote}
        customerData={selectedCustomer}
        projectData={selectedProject}
        availableProjects={projects}
        availableCustomers={customers}
        readOnly={true}
      />
    </div>
  );
}
