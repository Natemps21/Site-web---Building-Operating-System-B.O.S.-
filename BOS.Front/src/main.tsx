import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

// 1. IMPORT DU PROVIDER
import { ComparisonProvider } from "./context/ComparisonContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 2. ON ENVELOPPE L'APPLICATION ICI */}
    <ComparisonProvider>
      <App />
    </ComparisonProvider>
  </React.StrictMode>
);