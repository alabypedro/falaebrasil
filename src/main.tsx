import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupPWA } from "./lib/pwa";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker only outside iframe/preview contexts
setupPWA();
