import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
// Bundled fonts — load BEFORE index.css so @font-face declarations are
// registered before any rule that references the family names. Without this
// import the app falls back to system fonts when there is no network.
import "./fonts";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
