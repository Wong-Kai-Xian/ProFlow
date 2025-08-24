import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';

// Collection reference
const quotesCollectionRef = collection(db, 'quotes');

// Create a new quote
export const createQuote = async (quoteData) => {
  try {
    // Add timestamp
    const quoteWithTimestamp = {
      ...quoteData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(quotesCollectionRef, quoteWithTimestamp);
    return { id: docRef.id, ...quoteWithTimestamp };
  } catch (error) {
    console.error('Error creating quote:', error);
    throw error;
  }
};

// Update an existing quote
export const updateQuote = async (quoteId, quoteData) => {
  try {
    // Add updated timestamp
    const updatedQuote = {
      ...quoteData,
      updatedAt: new Date()
    };
    
    const quoteRef = doc(db, 'quotes', quoteId);
    await updateDoc(quoteRef, updatedQuote);
    return { id: quoteId, ...updatedQuote };
  } catch (error) {
    console.error('Error updating quote:', error);
    throw error;
  }
};

// Delete a quote
export const deleteQuote = async (quoteId) => {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    await deleteDoc(quoteRef);
    return true;
  } catch (error) {
    console.error('Error deleting quote:', error);
    throw error;
  }
};

// Get a specific quote by ID
export const getQuoteById = async (quoteId) => {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    const quoteSnap = await getDoc(quoteRef);
    
    if (quoteSnap.exists()) {
      return { id: quoteSnap.id, ...quoteSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting quote:', error);
    throw error;
  }
};

// Get all quotes for a specific user
export const getQuotesByUserId = async (userId) => {
  try {
    // Check if userId is valid
    if (!userId) {
      console.warn('getQuotesByUserId called with invalid userId');
      return [];
    }

    // Create a quotes collection reference if it doesn't exist
    try {
      console.log('Fetching quotes for user:', userId);
      
      // First try to get quotes without orderBy to avoid index issues
      const q = query(
        quotesCollectionRef, 
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const quotes = [];
      
      console.log('Quotes found:', querySnapshot.size);
      
      querySnapshot.forEach((doc) => {
        const quoteData = doc.data();
        // Convert Firestore timestamps to JavaScript dates
        const processedData = {
          ...quoteData,
          createdAt: quoteData.createdAt instanceof Date ? quoteData.createdAt : 
                    quoteData.createdAt?.toDate ? quoteData.createdAt.toDate() : new Date(),
          updatedAt: quoteData.updatedAt instanceof Date ? quoteData.updatedAt : 
                    quoteData.updatedAt?.toDate ? quoteData.updatedAt.toDate() : new Date()
        };
        quotes.push({ id: doc.id, ...processedData });
      });
      
      // Sort manually since we're not using orderBy
      quotes.sort((a, b) => b.createdAt - a.createdAt);
      
      return quotes;
    } catch (innerError) {
      console.error('Firestore error getting quotes:', innerError);
      
      // Try again without the where clause in case there's an issue with the query
      try {
        console.log('Trying alternative query approach');
        const allQuotesSnapshot = await getDocs(quotesCollectionRef);
        const quotes = [];
        
        allQuotesSnapshot.forEach((doc) => {
          const quoteData = doc.data();
          // Only include quotes for this user
          if (quoteData.userId === userId) {
            const processedData = {
              ...quoteData,
              createdAt: quoteData.createdAt instanceof Date ? quoteData.createdAt : 
                        quoteData.createdAt?.toDate ? quoteData.createdAt.toDate() : new Date(),
              updatedAt: quoteData.updatedAt instanceof Date ? quoteData.updatedAt : 
                        quoteData.updatedAt?.toDate ? quoteData.updatedAt.toDate() : new Date()
            };
            quotes.push({ id: doc.id, ...processedData });
          }
        });
        
        // Sort manually
        quotes.sort((a, b) => b.createdAt - a.createdAt);
        
        return quotes;
      } catch (fallbackError) {
        console.error('Fallback query failed:', fallbackError);
        return [];
      }
    }
  } catch (error) {
    console.error('Unexpected error getting quotes:', error);
    return []; // Return empty array instead of throwing
  }
};

// Get quotes by project ID
export const getQuotesByProjectId = async (projectId) => {
  try {
    const q = query(
      quotesCollectionRef, 
      where('projectInfo.id', '==', projectId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const quotes = [];
    
    querySnapshot.forEach((doc) => {
      quotes.push({ id: doc.id, ...doc.data() });
    });
    
    return quotes;
  } catch (error) {
    console.error('Error getting quotes by project:', error);
    throw error;
  }
};

// Get quotes by customer ID
export const getQuotesByCustomerId = async (customerId) => {
  try {
    const q = query(
      quotesCollectionRef, 
      where('customerInfo.id', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const quotes = [];
    
    querySnapshot.forEach((doc) => {
      quotes.push({ id: doc.id, ...doc.data() });
    });
    
    return quotes;
  } catch (error) {
    console.error('Error getting quotes by customer:', error);
    throw error;
  }
};

// Update quote status
export const updateQuoteStatus = async (quoteId, status) => {
  try {
    const quoteRef = doc(db, 'quotes', quoteId);
    await updateDoc(quoteRef, { 
      status, 
      updatedAt: new Date() 
    });
    return true;
  } catch (error) {
    console.error('Error updating quote status:', error);
    throw error;
  }
};

// Filter and sort quotes
export const filterQuotes = (quotes, filters) => {
  let filteredQuotes = [...quotes];
  
  // Apply search term filter
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredQuotes = filteredQuotes.filter(quote => 
      quote.quoteNumber.toLowerCase().includes(searchLower) ||
      quote.customerInfo.name.toLowerCase().includes(searchLower) ||
      quote.projectInfo.name.toLowerCase().includes(searchLower)
    );
  }
  
  // Apply status filter
  if (filters.statusFilter && filters.statusFilter !== 'all') {
    filteredQuotes = filteredQuotes.filter(quote => 
      quote.status === filters.statusFilter
    );
  }
  
  // Apply date sort
  if (filters.dateSort) {
    filteredQuotes.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      return filters.dateSort === 'newest' 
        ? dateB - dateA 
        : dateA - dateB;
    });
  }
  
  return filteredQuotes;
};
