import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./app/App.js";

// Reveal the viewport scrollbar only while scrolling (hides when idle).
let scrollIdleTimer: number | undefined;
window.addEventListener(
  "scroll",
  () => {
    document.documentElement.classList.add("scrolling");
    window.clearTimeout(scrollIdleTimer);
    scrollIdleTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("scrolling");
    }, 800);
  },
  { passive: true },
);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
