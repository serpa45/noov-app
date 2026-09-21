import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const APP_CACHE_PREFIX = "noov-pwa-";

const isAppServiceWorker = (registration: ServiceWorkerRegistration) => {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker?.scriptURL) return false;

  try {
    return new URL(worker.scriptURL).pathname === "/sw.js";
  } catch {
    return false;
  }
};

const isAppCache = (cacheName: string) =>
  cacheName.startsWith(APP_CACHE_PREFIX) ||
  /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(cacheName);

const cleanupLegacyAppShell = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(
        registrations.filter(isAppServiceWorker).map((registration) => registration.unregister()),
      );
    }
  } catch {
    /* silencioso */
  }

  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.filter(isAppCache).map((cacheName) => caches.delete(cacheName)));
    }
  } catch {
    /* silencioso */
  }
};

// Renderiza o app — chamado após (possível) checagem de atualização
const renderApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
};

renderApp();

window.addEventListener("load", () => {
  void cleanupLegacyAppShell();
});
