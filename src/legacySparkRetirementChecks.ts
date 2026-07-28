import { legacySparkRetirementBackupPlanCheckCount } from "./legacySparkRetirementBackupPlanChecks";
import { legacySparkRetirementDriveV1BackupVerifierCheckCount } from "./legacySparkRetirementDriveV1BackupVerifierChecks";
import { legacySparkRetirementInventoryCheckCount } from "./legacySparkRetirementInventoryChecks";
import { legacySparkRetirementWriterDbBackupVerifierCheckCount } from "./legacySparkRetirementWriterDbBackupVerifierChecks";

const total = legacySparkRetirementInventoryCheckCount +
  legacySparkRetirementBackupPlanCheckCount +
  legacySparkRetirementDriveV1BackupVerifierCheckCount +
  legacySparkRetirementWriterDbBackupVerifierCheckCount;
console.log(`Legacy Spark retirement total checks: ${total}/${total} passed.`);
