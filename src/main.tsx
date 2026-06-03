 import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { HelmetProvider } from "react-helmet-async";

 // Fix: ResizeObserver loop completed with undelivered notifications.
 // This error is common in Chrome with some UI libraries and is generally benign.
 if (typeof window !== 'undefined') {
   const resizeObserverErr = 'ResizeObserver loop completed with undelivered notifications.';
   const originalError = window.console.error;
   window.console.error = (...args) => {
     if (args[0]?.includes?.(resizeObserverErr) || args[0] === resizeObserverErr) {
       return;
     }
     originalError(...args);
   };
   
   window.addEventListener('error', (e) => {
     if (e.message === resizeObserverErr || e.message?.includes?.(resizeObserverErr)) {
       const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
       if (resizeObserverErrDiv) resizeObserverErrDiv.setAttribute('style', 'display: none');
       const resizeObserverErrStyle = document.getElementById('webpack-dev-server-client-overlay');
       if (resizeObserverErrStyle) resizeObserverErrStyle.setAttribute('style', 'display: none');
       e.stopImmediatePropagation();
     }
   });
 }
 
createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);
