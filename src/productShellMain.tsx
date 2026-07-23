import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProductShellPrototype } from "./ProductShellPrototype";
import { resolveProductShellDataMode } from "./productShellDataMode";
import { assembleProductShellData } from "./productShellReadOnlyLibrary";
import { loadWriterPackageCatalog } from "./writerPackageStorage";
import "./productShellPrototype.css";

const root = document.getElementById("product-shell-root");

if (!root) {
  throw new Error("Product shell root element not found");
}

const dataMode = resolveProductShellDataMode({
  isDevelopment: import.meta.env.DEV,
  search: window.location.search
});
const data =
  dataMode === "real-read-only"
    ? assembleProductShellData({
        dataMode,
        catalogLoader: loadWriterPackageCatalog
      })
    : assembleProductShellData({ dataMode });

createRoot(root).render(
  <StrictMode>
    <ProductShellPrototype data={data} />
  </StrictMode>
);
