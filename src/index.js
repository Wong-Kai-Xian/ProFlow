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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project" element={<ProjectList />} />
        <Route path="/project/:projectName" element={<ProjectDetail />} /> {/* New route for project details */}
        <Route path="/forum" element={<ForumListPage />} /> {/* forum list */}
        <Route path="/forum/:id" element={<Forum />} />     {/* single forum */}
        <Route path="/customer-profiles" element={<CustomerProfileList />} />
        <Route path="/customer/:id" element={<CustomerProfile />} />
        <Route path="/approvals" element={<ApprovalList />} /> {/* New route for ApprovalList */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
