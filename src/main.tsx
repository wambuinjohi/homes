import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ImpersonationProvider } from "@/hooks/useImpersonation";

// Initialize production services
import './utils/productionConfig';
import './utils/consoleReplacer';
import './utils/consoleLogCleaner';


createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ImpersonationProvider>
      <App />
    </ImpersonationProvider>
  </React.StrictMode>
);
