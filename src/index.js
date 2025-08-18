// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Forum from "./pages/Forum";
import ForumListPage from "./pages/ForumListPage";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/forum" element={<ForumListPage />} />
        <Route path="/forum/:id" element={<Forum />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);