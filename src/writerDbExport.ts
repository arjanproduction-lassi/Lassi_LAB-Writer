import { loadWriterDbExportSparks } from "./storage";
import { loadWriterPackages } from "./writerPackageStorage";
import { createWriterDbV2Payload } from "./writerDb";

function formatDatePart(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createManualWriterDbV2Export() {
  return createWriterDbV2Payload({
    sparks: loadWriterDbExportSparks(),
    packages: loadWriterPackages()
  });
}

export function getManualWriterDbV2ExportFileName(date = new Date()) {
  return `LassiLAB_Writer_DBv002_${formatDatePart(date)}.json`;
}
