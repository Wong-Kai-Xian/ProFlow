import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Forum from "./pages/Forum";
import Project from "./pages/Project";
import ForumListPage from "./pages/ForumListPage";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project" element={<Project />} />
        <Route path="/forum" element={<ForumListPage />} /> {/* forum list */}
        <Route path="/forum/:id" element={<Forum />} />     {/* single forum */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
