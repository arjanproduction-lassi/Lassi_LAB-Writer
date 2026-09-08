import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProductShellPrototype } from "./ProductShellPrototype";
import { resolveProductShellDataMode } from "./productShellDataMode";
import { assembleProductShellData } from "./productShellReadOnlyLibrary";
import { createProductShellWorkshopEditRuntime } from "./productShellWorkshopEditRuntime";
import {
  WRITER_PACKAGE_WORKSHOP_EDIT_MODE,
  createWriterPackageWorkshopBrowserNow,
  createWriterPackageWorkshopBrowserStorage,
  resolveWriterPackageWorkshopEditMode,
  type WriterPackageWorkshopBeforeUnloadHandler,
  type WriterPackageWorkshopBeforeUnloadTarget,
  type WriterPackageWorkshopBrowserLockManager,
  type WriterPackageWorkshopTimerTarget
} from "./writerPackageWorkshopBrowserAdapters";
import { loadWriterPackageCatalog } from "./writerPackageStorage";
import "./productShellPrototype.css";

const root = document.getElementById("product-shell-root");

if (!root) {
  throw new Error("Product shell root element not found");
}

function getBrowserLocks(): WriterPackageWorkshopBrowserLockManager | undefined {
  return (navigator as Navigator & {
    locks?: WriterPackageWorkshopBrowserLockManager;
  }).locks;
}

function createBrowserTimerTarget(): WriterPackageWorkshopTimerTarget {
  return Object.freeze({
    setTimeout(callback, delayMs) {
      return window.setTimeout(callback, delayMs);
    },
    clearTimeout(handle) {
      window.clearTimeout(handle as number);
    }
  });
}

function createBrowserBeforeUnloadTarget(): WriterPackageWorkshopBeforeUnloadTarget {
  return Object.freeze({
    addEventListener(_type, handler) {
      window.addEventListener(
        "beforeunload",
        handler as WriterPackageWorkshopBeforeUnloadHandler & EventListener
      );
    },
    removeEventListener(_type, handler) {
      window.removeEventListener(
        "beforeunload",
        handler as WriterPackageWorkshopBeforeUnloadHandler & EventListener
      );
    }
  });
}

const dataMode = resolveProductShellDataMode({
  isDevelopment: import.meta.env.DEV,
  search: window.location.search
});
const workshopEditMode = resolveWriterPackageWorkshopEditMode({
  isDevelopment: import.meta.env.DEV,
  search: window.location.search
});
const data =
  workshopEditMode === WRITER_PACKAGE_WORKSHOP_EDIT_MODE
    ? assembleProductShellData({
        dataMode: WRITER_PACKAGE_WORKSHOP_EDIT_MODE,
        catalogLoader: loadWriterPackageCatalog,
        workshop: createProductShellWorkshopEditRuntime({
          storage: createWriterPackageWorkshopBrowserStorage(window.localStorage),
          locks: getBrowserLocks(),
          timers: createBrowserTimerTarget(),
          beforeUnloadTarget: createBrowserBeforeUnloadTarget(),
          now: createWriterPackageWorkshopBrowserNow(),
          confirmUnsavedExit() {
            return window.confirm(
              "Lokálny návrh ešte nie je bezpečne uložený. Opustiť tento stav?"
            );
          }
        })
      })
    : dataMode === "real-read-only"
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
