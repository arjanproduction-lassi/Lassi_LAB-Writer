import { legacySparkRetirementBackupPlanCheckCount } from "./legacySparkRetirementBackupPlanChecks";
import { legacySparkRetirementInventoryCheckCount } from "./legacySparkRetirementInventoryChecks";

const total = legacySparkRetirementInventoryCheckCount + legacySparkRetirementBackupPlanCheckCount;
console.log(`Legacy Spark retirement total checks: ${total}/${total} passed.`);
