import { legacySparkRetirementBackupPlanCheckCount } from "./legacySparkRetirementBackupPlanChecks";
import { legacySparkRetirementBackupAssemblyCheckCount } from "./legacySparkRetirementBackupAssemblyChecks";
import { legacySparkRetirementBackupGuideStateCheckCount } from "./legacySparkRetirementBackupGuideStateChecks";
import { legacySparkRetirementBrowserAdaptersCheckCount } from "./legacySparkRetirementBrowserAdaptersChecks";
import { legacySparkRetirementDriveV1BackupVerifierCheckCount } from "./legacySparkRetirementDriveV1BackupVerifierChecks";
import { legacySparkRetirementInventoryCheckCount } from "./legacySparkRetirementInventoryChecks";
import { legacySparkRetirementLocalSnapshotCheckCount } from "./legacySparkRetirementLocalSnapshotChecks";
import { legacySparkRetirementLocalStorageCaptureCheckCount } from "./legacySparkRetirementLocalStorageCaptureChecks";
import { legacySparkRetirementPackageBaselineCheckCount } from "./legacySparkRetirementPackageBaselineChecks";
import { legacySparkRetirementWriterDbBackupVerifierCheckCount } from "./legacySparkRetirementWriterDbBackupVerifierChecks";
import { legacySparkRetirementWriterDbBytesBuilderCheckCount } from "./legacySparkRetirementWriterDbBytesBuilderChecks";

async function runLegacySparkRetirementChecks() {
  const total = legacySparkRetirementInventoryCheckCount +
    legacySparkRetirementLocalSnapshotCheckCount +
    legacySparkRetirementLocalStorageCaptureCheckCount +
    legacySparkRetirementBackupPlanCheckCount +
    await legacySparkRetirementBackupAssemblyCheckCount +
    legacySparkRetirementBackupGuideStateCheckCount +
    await legacySparkRetirementBrowserAdaptersCheckCount +
    legacySparkRetirementDriveV1BackupVerifierCheckCount +
    await legacySparkRetirementPackageBaselineCheckCount +
    legacySparkRetirementWriterDbBytesBuilderCheckCount +
    legacySparkRetirementWriterDbBackupVerifierCheckCount;
  console.log(`Legacy Spark retirement total checks: ${total}/${total} passed.`);
}

void runLegacySparkRetirementChecks();
