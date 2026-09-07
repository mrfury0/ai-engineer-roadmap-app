import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ProgressProvider } from "./state/ProgressContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </StrictMode>,
);
