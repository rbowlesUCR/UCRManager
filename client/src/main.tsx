import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  createRoot(rootElement).render(<App />);
} catch (error) {
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: monospace;">
    <h1>Error loading application</h1>
    <pre>${error instanceof Error ? error.message + '\n' + error.stack : String(error)}</pre>
  </div>`;
  console.error("Failed to render app:", error);
}
