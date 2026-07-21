export type ProductShellView = "library" | "workshop" | "data";

export type ProductShellLayer = "spark" | "notes" | "workshop" | "final";

export type ProductShellViewport = "desktop" | "mobile";

export type ProductShellNote = {
  id: string;
  text: string;
  updatedAt: string;
};

export type ProductShellPackage = {
  id: string;
  title: string;
  sparkText: string;
  notes: ProductShellNote[];
  workshopText: string;
  finalText: string;
  updatedAt: string;
};

export type ProductShellState = {
  view: ProductShellView;
  selectedPackageId: string | null;
  activeLayer: ProductShellLayer;
};

export type ProductShellEvent =
  | { type: "navigate"; view: ProductShellView }
  | { type: "open-package"; packageId: string }
  | { type: "new-spark" }
  | { type: "back-to-library" }
  | { type: "select-layer"; layer: ProductShellLayer };

export const PRODUCT_SHELL_NAV_ITEMS: ReadonlyArray<{
  id: ProductShellView;
  label: string;
}> = [
  { id: "library", label: "Knižnica" },
  { id: "workshop", label: "Dielňa" },
  { id: "data", label: "Dáta" }
];

export const PRODUCT_SHELL_LAYERS: ReadonlyArray<{
  id: ProductShellLayer;
  label: string;
}> = [
  { id: "spark", label: "Iskra" },
  { id: "notes", label: "Poznámky" },
  { id: "workshop", label: "Dielňa" },
  { id: "final", label: "Text OK" }
];

export const PRODUCT_SHELL_NEW_PACKAGE_ID = "prototype-new-package";

const FIXTURE_PACKAGES: ReadonlyArray<ProductShellPackage> = [
  {
    id: "fixture-stara-cesta",
    title: "Pieseň o starej ceste",
    sparkText: "Stará cesta si pamätá kroky aj vtedy, keď už mená zmizli.",
    notes: [
      {
        id: "fixture-note-road-1",
        text: "Obraz prachu na topánkach a svetla tesne pred dažďom.",
        updatedAt: "2026-07-21T08:15:00.000Z"
      },
      {
        id: "fixture-note-road-2",
        text: "Refrén by sa mohol vracať k otázke, kto si cestu ešte pamätá.",
        updatedAt: "2026-07-21T08:28:00.000Z"
      },
      {
        id: "fixture-note-road-3",
        text: "Držať jazyk jednoduchý, bez nostalgických klišé.",
        updatedAt: "2026-07-21T08:42:00.000Z"
      }
    ],
    workshopText:
      "Na starej ceste ostal prach,\nčo pozná váhu našich krokov.\nRáno ho zdvihne tichý vietor\na nesie ďalej bez otázok.",
    finalText:
      "Na starej ceste ostal prach,\nčo pozná váhu našich krokov.",
    updatedAt: "2026-07-21T08:42:00.000Z"
  },
  {
    id: "fixture-ranna-kava",
    title: "Nápad pri rannej káve",
    sparkText: "Para nad šálkou na chvíľu kreslí mapu mesta, ktoré neexistuje.",
    notes: [
      {
        id: "fixture-note-coffee-1",
        text: "Krátky prozaický text, pokojný začiatok a zvláštne posledné dve vety.",
        updatedAt: "2026-07-20T06:55:00.000Z"
      },
      {
        id: "fixture-note-coffee-2",
        text: "Mesto zmizne vo chvíli, keď sa káva ochladí.",
        updatedAt: "2026-07-20T07:03:00.000Z"
      }
    ],
    workshopText:
      "Každé ráno vznikalo nad stolom malé mesto. Nemalo ulice, iba paru a niekoľko okien, cez ktoré sa nedalo pozerať späť.",
    finalText: "",
    updatedAt: "2026-07-20T07:03:00.000Z"
  },
  {
    id: "fixture-test-package",
    title: "Testovací balík",
    sparkText: "Jedna bezpečná umelá veta na skúšanie novej dielne.",
    notes: [
      {
        id: "fixture-note-test-1",
        text: "Táto poznámka je iba fixture a po obnovení stránky sa môže stratiť.",
        updatedAt: "2026-07-19T14:10:00.000Z"
      }
    ],
    workshopText: "Pracovný text bez väzby na produkčné dáta.",
    finalText: "Čistý testovací výsledok.",
    updatedAt: "2026-07-19T14:10:00.000Z"
  }
];

export function createProductShellFixtures(): ProductShellPackage[] {
  return FIXTURE_PACKAGES.map((writerPackage) => ({
    ...writerPackage,
    notes: writerPackage.notes.map((note) => ({ ...note }))
  }));
}

export function createEmptyProductShellPackage(): ProductShellPackage {
  return {
    id: PRODUCT_SHELL_NEW_PACKAGE_ID,
    title: "Nová prototypová iskra",
    sparkText: "",
    notes: [],
    workshopText: "",
    finalText: "",
    updatedAt: "2026-07-21T09:00:00.000Z"
  };
}

export function createInitialProductShellState(): ProductShellState {
  return {
    view: "library",
    selectedPackageId: FIXTURE_PACKAGES[0]?.id ?? null,
    activeLayer: "spark"
  };
}

export function transitionProductShell(
  state: ProductShellState,
  event: ProductShellEvent
): ProductShellState {
  switch (event.type) {
    case "navigate":
      return {
        ...state,
        view:
          event.view === "workshop" && !state.selectedPackageId
            ? "library"
            : event.view
      };
    case "open-package":
      return {
        view: "workshop",
        selectedPackageId: event.packageId,
        activeLayer: "spark"
      };
    case "new-spark":
      return {
        view: "workshop",
        selectedPackageId: PRODUCT_SHELL_NEW_PACKAGE_ID,
        activeLayer: "spark"
      };
    case "back-to-library":
      return { ...state, view: "library" };
    case "select-layer":
      return { ...state, activeLayer: event.layer };
  }
}

export function getProductShellContextLayer(
  activeLayer: ProductShellLayer
): ProductShellLayer {
  const activeIndex = PRODUCT_SHELL_LAYERS.findIndex(
    (layer) => layer.id === activeLayer
  );
  const contextIndex = activeIndex > 0 ? activeIndex - 1 : 1;
  return PRODUCT_SHELL_LAYERS[contextIndex]?.id ?? "spark";
}

export function getVisibleProductShellLayers(
  viewport: ProductShellViewport,
  activeLayer: ProductShellLayer
): ProductShellLayer[] {
  if (viewport === "mobile") {
    return [activeLayer];
  }

  return [getProductShellContextLayer(activeLayer), activeLayer];
}

export function getProductShellProgress(writerPackage: ProductShellPackage) {
  if (writerPackage.finalText.trim()) {
    return "Má Text OK";
  }
  if (writerPackage.workshopText.trim()) {
    return "Rozpracované v Dielni";
  }
  if (writerPackage.notes.length) {
    return `${writerPackage.notes.length} poznámky`;
  }
  return "Čerstvá iskra";
}
