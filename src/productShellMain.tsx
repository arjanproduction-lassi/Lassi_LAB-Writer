import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProductShellPrototype } from "./ProductShellPrototype";
import "./productShellPrototype.css";

const root = document.getElementById("product-shell-root");

if (!root) {
  throw new Error("Product shell root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ProductShellPrototype />
  </StrictMode>
);
