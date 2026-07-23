import { resolveProductShellDataMode } from "./productShellDataMode";

let passed = 0;

function check(name: string, condition: boolean) {
  if (!condition) {
    throw new Error(`Product shell data mode check failed: ${name}`);
  }

  passed += 1;
}

const resolveDevelopmentSearch = (search: string) =>
  resolveProductShellDataMode({ isDevelopment: true, search });

check("absent query uses fixtures", resolveDevelopmentSearch("") === "fixture");
check("explicit fixture uses fixtures", resolveDevelopmentSearch("?mode=fixture") === "fixture");
check(
  "real read-only is available in development",
  resolveDevelopmentSearch("?mode=real-read-only") === "real-read-only"
);
check(
  "real read-only fails closed outside development",
  resolveProductShellDataMode({
    isDevelopment: false,
    search: "?mode=real-read-only"
  }) === "fixture"
);
check("unknown mode uses fixtures", resolveDevelopmentSearch("?mode=unknown") === "fixture");
check("empty mode uses fixtures", resolveDevelopmentSearch("?mode=") === "fixture");
check(
  "case mismatch uses fixtures",
  resolveDevelopmentSearch("?mode=REAL-READ-ONLY") === "fixture"
);
check(
  "unrelated parameters do not change the selected mode",
  resolveDevelopmentSearch("?preview=1&mode=real-read-only&panel=library") ===
    "real-read-only"
);
check(
  "query order is irrelevant",
  resolveDevelopmentSearch("?mode=real-read-only&preview=1") ===
    resolveDevelopmentSearch("?preview=1&mode=real-read-only")
);
check(
  "resolution is deterministic",
  resolveDevelopmentSearch("?preview=1&mode=real-read-only") ===
    resolveDevelopmentSearch("?preview=1&mode=real-read-only")
);
check("malformed query fails closed", resolveDevelopmentSearch("?%ZZ=1") === "fixture");

console.log(`Product shell data mode checks: ${passed}/${passed} passed.`);
