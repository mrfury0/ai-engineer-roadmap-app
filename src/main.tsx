import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { AuthProvider } from "./state/AuthContext";
import { ProgressProvider } from "./state/ProgressContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <ProgressProvider>
          <App />
        </ProgressProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
