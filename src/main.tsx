import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/comic-neue/400.css";
import "@fontsource/comic-neue/700.css";
import "./index.css";
import App from "./App";

registerSW({ immediate: true });

if ("serviceWorker" in navigator) {
  const checkForUpdate = () => {
    if (document.visibilityState !== "visible") return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.update())
      .catch(() => {});
  };

  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", checkForUpdate);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
