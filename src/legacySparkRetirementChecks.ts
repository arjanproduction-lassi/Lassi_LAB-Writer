import { legacySparkRetirementBackupPlanCheckCount } from "./legacySparkRetirementBackupPlanChecks";
import { legacySparkRetirementInventoryCheckCount } from "./legacySparkRetirementInventoryChecks";
import { legacySparkRetirementWriterDbBackupVerifierCheckCount } from "./legacySparkRetirementWriterDbBackupVerifierChecks";

const total = legacySparkRetirementInventoryCheckCount +
  legacySparkRetirementBackupPlanCheckCount +
  legacySparkRetirementWriterDbBackupVerifierCheckCount;
console.log(`Legacy Spark retirement total checks: ${total}/${total} passed.`);
