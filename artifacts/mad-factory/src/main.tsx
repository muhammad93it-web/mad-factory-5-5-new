import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalNumeralNormalizer } from "./lib/normalize-numerals";
import { installAutoSync, installFetchOfflineQueue } from "./lib/sync-queue";

installGlobalNumeralNormalizer();
installFetchOfflineQueue();
installAutoSync();

// Service worker registration with update detection
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Detect a new worker becoming available
        const notify = (sw: ServiceWorker | null) => {
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent("mf:update-available", { detail: { worker: sw } }),
              );
            }
          });
        };
        if (reg.waiting) {
          window.dispatchEvent(
            new CustomEvent("mf:update-available", { detail: { worker: reg.waiting } }),
          );
        }
        reg.addEventListener("updatefound", () => notify(reg.installing));
        // Periodic check for updates (every 30 min)
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
