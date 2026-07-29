import { legacySparkRetirementBackupPlanCheckCount } from "./legacySparkRetirementBackupPlanChecks";
import { legacySparkRetirementBackupAssemblyCheckCount } from "./legacySparkRetirementBackupAssemblyChecks";
import { legacySparkRetirementDriveV1BackupVerifierCheckCount } from "./legacySparkRetirementDriveV1BackupVerifierChecks";
import { legacySparkRetirementInventoryCheckCount } from "./legacySparkRetirementInventoryChecks";
import { legacySparkRetirementPackageBaselineCheckCount } from "./legacySparkRetirementPackageBaselineChecks";
import { legacySparkRetirementWriterDbBackupVerifierCheckCount } from "./legacySparkRetirementWriterDbBackupVerifierChecks";

async function runLegacySparkRetirementChecks() {
  const total = legacySparkRetirementInventoryCheckCount +
    legacySparkRetirementBackupPlanCheckCount +
    await legacySparkRetirementBackupAssemblyCheckCount +
    legacySparkRetirementDriveV1BackupVerifierCheckCount +
    await legacySparkRetirementPackageBaselineCheckCount +
    legacySparkRetirementWriterDbBackupVerifierCheckCount;
  console.log(`Legacy Spark retirement total checks: ${total}/${total} passed.`);
}

void runLegacySparkRetirementChecks();
