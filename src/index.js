// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Forum from "./pages/Forum";
<<<<<<< HEAD
import Project from "./pages/Project";

=======
import ForumListPage from "./pages/ForumListPage";
>>>>>>> 07d48fc6d2ad279409b12c223de3dfbc88c8a5a7

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
<<<<<<< HEAD
        <Route path="/forum" element={<Forum />} />
        <Route path="/project" element={<Project />} />
=======
        <Route path="/forum" element={<ForumListPage />} />
        <Route path="/forum/:id" element={<Forum />} />
>>>>>>> 07d48fc6d2ad279409b12c223de3dfbc88c8a5a7
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);