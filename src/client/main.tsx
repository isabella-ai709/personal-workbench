import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./app";
import "./styles/tokens.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("找不到工作台挂载节点");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
