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
