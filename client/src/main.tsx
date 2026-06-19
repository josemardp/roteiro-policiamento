import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for PWA Offline Caching
// Usa BASE_URL para funcionar tanto em dev ("/") quanto no GitHub Pages
// ("/roteiro-policiamento/"). Registrar em "/sw.js" dava 404 em produção.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((reg) => {
        console.log("Service Worker registrado com sucesso:", reg.scope);
      })
      .catch((err) => {
        console.error("Falha ao registrar Service Worker:", err);
      });
  });
}

