import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProductShellPrototype } from "./ProductShellPrototype";
import { resolveProductShellDataMode } from "./productShellDataMode";
import "./productShellPrototype.css";

const root = document.getElementById("product-shell-root");

if (!root) {
  throw new Error("Product shell root element not found");
}

const dataMode = resolveProductShellDataMode({
  isDevelopment: import.meta.env.DEV,
  search: window.location.search
});

createRoot(root).render(
  <StrictMode>
    <ProductShellPrototype dataMode={dataMode} />
  </StrictMode>
);
