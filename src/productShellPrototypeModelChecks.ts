import {
  PRODUCT_SHELL_LAYERS,
  PRODUCT_SHELL_NAV_ITEMS,
  PRODUCT_SHELL_NEW_PACKAGE_ID,
  createInitialProductShellState,
  createProductShellFixtures,
  getVisibleProductShellLayers,
  transitionProductShell
} from "./productShellPrototypeModel";

let passed = 0;

function check(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

const initial = createInitialProductShellState();
const fixtures = createProductShellFixtures();

check(
  PRODUCT_SHELL_NAV_ITEMS.map((item) => item.label).join("/") ===
    "Knižnica/Dielňa/Dáta",
  "Main navigation must contain Knižnica, Dielňa, and Dáta."
);
check(initial.view === "library", "The prototype must start in Knižnica.");

const opened = transitionProductShell(initial, {
  type: "open-package",
  packageId: fixtures[1].id
});
check(
  opened.view === "workshop" && opened.selectedPackageId === fixtures[1].id,
  "Opening a fixture package must show its Dielňa."
);

const returned = transitionProductShell(opened, { type: "back-to-library" });
check(returned.view === "library", "Back must return to Knižnica.");

const selectedLayers = PRODUCT_SHELL_LAYERS.map((layer) =>
  transitionProductShell(opened, { type: "select-layer", layer: layer.id })
);
check(
  selectedLayers.every(
    (state, index) => state.activeLayer === PRODUCT_SHELL_LAYERS[index].id
  ),
  "Every workshop layer must be selectable."
);

check(
  getVisibleProductShellLayers("mobile", "workshop").join(",") === "workshop",
  "Mobile must show only the active layer."
);
check(
  getVisibleProductShellLayers("desktop", "workshop").join(",") ===
    "notes,workshop",
  "Desktop must expose one context layer and one active layer."
);

const newSpark = transitionProductShell(initial, { type: "new-spark" });
check(
  newSpark.view === "workshop" &&
    newSpark.selectedPackageId === PRODUCT_SHELL_NEW_PACKAGE_ID,
  "New Spark must open only the local prototype package."
);

const isolatedFixtures = createProductShellFixtures();
isolatedFixtures[0].notes[0].text = "changed only in returned fixtures";
check(
  createProductShellFixtures()[0].notes[0].text !== isolatedFixtures[0].notes[0].text,
  "Fixture factory must return isolated objects for local-only editing."
);

console.log(`Product shell model checks: ${passed}/${passed} passed.`);
