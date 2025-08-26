import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Forum from "./pages/Forum";
import ProjectList from "./pages/ProjectList";
import ForumListPage from "./pages/ForumListPage";
import CustomerProfile from "./pages/CustomerProfile";
import ProjectDetail from "./pages/ProjectDetail";
import CustomerProfileList from "./pages/CustomerProfileList";
import ApprovalList from "./pages/ApprovalList"; // Import the new ApprovalList component
import ApprovalPage from "./pages/ApprovalPage"; // Import the new ApprovalPage component
import Login from "./pages/Login"; // Import the new Login component
import Signup from "./pages/Signup"; // Import the new Signup component
import VerifyEmail from "./pages/VerifyEmail"; // Import the VerifyEmail component
import ForgotPassword from "./pages/ForgotPassword"; // Import the ForgotPassword component
import UserProfile from "./pages/UserProfile"; // Import the new UserProfile component
import TeamPage from "./pages/TeamPage"; // Import the new TeamPage component
import FinancePage from "./pages/FinancePage";
import { AuthProvider } from './contexts/AuthContext'; // Import AuthProvider
import PrivateRoute from './components/PrivateRoute'; // Import PrivateRoute
import PersonalAssistant from './components/PersonalAssistant';

// Initialize optional API keys in localStorage (idempotent, won't overwrite if already set)
try {
  if (!localStorage.getItem('gemini_api_key')) localStorage.setItem('gemini_api_key', 'AIzaSyD9N4nAeSwJUOgaG5RGrLQ8y_YGpr4yhz0');
  if (!localStorage.getItem('serp_api_key')) localStorage.setItem('serp_api_key', '4839a34efb07e55efb63734f2024be43ca37a307ba1cdb6437a50d87ccc59cf9');
  if (!localStorage.getItem('news_api_key')) localStorage.setItem('news_api_key', '7c735c9ec34b40909ba52317409fe094');
  // Set Google OAuth Client ID for Gmail API usage
  localStorage.setItem('google_oauth_client_id', '278194395988-j80gutsoppmqg3jt4cf4tleoma60kc6h.apps.googleusercontent.com');
} catch {}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider> {/* Wrap the entire app with AuthProvider */}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route 
            path="/profile/:userId"
            element={
              <PrivateRoute>
                <UserProfile />
              </PrivateRoute>
            }
          />
          <Route 
            path="/project" 
            element={
              <PrivateRoute>
                <ProjectList />
              </PrivateRoute>
            }
          />
          <Route 
            path="/project/:projectId" 
            element={
              <PrivateRoute>
                <ProjectDetail />
              </PrivateRoute>
            }
          />
          <Route 
            path="/forum" 
            element={
              <PrivateRoute>
                <ForumListPage />
              </PrivateRoute>
            }
          />
          <Route 
            path="/forum/:id" 
            element={
              <PrivateRoute>
                <Forum />
              </PrivateRoute>
            }
          />
          <Route 
            path="/customer-profiles" 
            element={
              <PrivateRoute>
                <CustomerProfileList />
              </PrivateRoute>
            }
          />
          <Route 
            path="/customer/:id" 
            element={
              <PrivateRoute>
                <CustomerProfile />
              </PrivateRoute>
            }
          />
          <Route 
            path="/approvals" 
            element={
              <PrivateRoute>
                <ApprovalPage />
              </PrivateRoute>
            }
          />
          <Route 
            path="/approvals-old" 
            element={
              <PrivateRoute>
                <ApprovalList />
              </PrivateRoute>
            }
          />
          <Route 
            path="/team" 
            element={
              <PrivateRoute>
                <TeamPage />
              </PrivateRoute>
            }
          />
          <Route 
            path="/finance" 
            element={
              <PrivateRoute>
                <FinancePage />
              </PrivateRoute>
            }
          />
        </Routes>
        <PersonalAssistant />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
