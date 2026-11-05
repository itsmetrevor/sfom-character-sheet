import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveCharacter } from "../src/lib/domain/calc.js";
import {
  applyPackToOverlay,
  buildGameData,
  ConfigError,
  createPack,
  fileProvenance,
  mergeFileMaps,
  parsePack,
  type ConfigOverlay,
} from "../src/lib/domain/config.js";
import { readDirFileMap } from "../src/lib/domain/configNode.js";
import {
  OverlayStore,
  RevisionStore,
} from "../src/lib/domain/configStore.js";

const CONFIG_DIR = join(process.cwd(), "public/config");

async function baseMap() {
  return readDirFileMap(CONFIG_DIR);
}

describe("overlay merging", () => {
  it("later overlays win and untouched files survive", async () => {
    const base = await baseMap();
    const original = base.get("ancestries/enatt.yaml")!;
    const tweaked = original.replace("max-hp: 9", "max-hp: 20");
    const overlay: ConfigOverlay = new Map([["ancestries/enatt.yaml", tweaked]]);
    const merged = mergeFileMaps(base, overlay);
    expect(merged.get("ancestries/enatt.yaml")).toBe(tweaked);
    expect(merged.get("ancestries/halthket.yaml")).toBe(
      base.get("ancestries/halthket.yaml"),
    );
    expect(merged.size).toBe(base.size);

    const game = await buildGameData(base, [overlay]);
    const derived = deriveCharacter(game, game.characterTemplate);
    // Template ancestry is enatt with +9 max-hp; override raises it to +20 (base 30).
    expect(derived.maxHp).toBe(30 + 20);
  });

  it("tombstones delete base files", async () => {
    const base = await baseMap();
    const merged = mergeFileMaps(
      base,
      new Map([["items/rope.yaml", null]]),
    );
    expect(merged.has("items/rope.yaml")).toBe(false);
    expect(merged.size).toBe(base.size - 1);
  });

  it("rejects unknown overlay paths", async () => {
    const base = await baseMap();
    expect(() =>
      mergeFileMaps(base, new Map([["classes2/fake.yaml", "id: fake"]]) as ConfigOverlay),
    ).toThrowError(ConfigError);
    expect(() =>
      mergeFileMaps(base, new Map([["rules/fake.yaml", "id: fake"]]) as ConfigOverlay),
    ).toThrowError(ConfigError);
  });

  it("rejects tombstones without a base file", async () => {
    const base = await baseMap();
    expect(() =>
      mergeFileMaps(base, new Map([["classes/nope.yaml", null]])),
    ).toThrowError(ConfigError);
  });

  it("merged validation catches cross-layer duplicate ids", async () => {
    const base = await baseMap();
    const scholar = base.get("classes/scholar.yaml")!;
    const overlay: ConfigOverlay = new Map([["classes/scholar-copy.yaml", scholar]]);
    await expect(buildGameData(base, [overlay])).rejects.toThrowError(ConfigError);
  });

  it("merged validation rejects broken user YAML", async () => {
    const base = await baseMap();
    const overlay: ConfigOverlay = new Map([
      ["items/rope.yaml", "id: rope\nname: [unclosed"],
    ]);
    await expect(buildGameData(base, [overlay])).rejects.toThrowError(ConfigError);
  });

  it("supports adding brand-new entity files", async () => {
    const base = await baseMap();
    const item = [
      "id: test-charm",
      "name: Test Charm",
      "slot: accessory",
      "damage-type: none",
      "effect: A test trinket.",
      "stack-max: 1",
      "",
    ].join("\n");
    const game = await buildGameData(base, [
      new Map([["items/test-charm.yaml", item]]),
    ]);
    expect(game.item("test-charm")?.name).toBe("Test Charm");
    expect(game.items).toHaveLength(36);
  });
});

describe("file provenance", () => {
  it("classifies layers correctly", async () => {
    const base = await baseMap();
    const upstream: ConfigOverlay = new Map([["items/rope.yaml", "id: rope\n"]]);
    const user: ConfigOverlay = new Map([
      ["classes/scholar.yaml", "id: scholar\n"],
      ["items/test-charm.yaml", "id: test-charm\n"],
      ["items/net.yaml", null],
    ]);
    expect(fileProvenance(base, upstream, user, "items/rope.yaml")).toBe("modified");
    expect(fileProvenance(base, upstream, user, "classes/scholar.yaml")).toBe("modified");
    expect(fileProvenance(base, upstream, user, "items/test-charm.yaml")).toBe("added");
    expect(fileProvenance(base, upstream, user, "items/net.yaml")).toBe("deleted");
    expect(fileProvenance(base, upstream, user, "items/lockpicks.yaml")).toBe("official");
  });
});

describe("config packs", () => {
  it("round-trips through JSON", () => {
    const overlay: ConfigOverlay = new Map([
      ["items/test-charm.yaml", "id: test-charm\n"],
      ["items/net.yaml", null],
    ]);
    const pack = createPack("My Pack", overlay, 3, "Tester");
    const parsed = parsePack(JSON.stringify(pack));
    expect(parsed).toEqual(pack);

    const applied = applyPackToOverlay(new Map(), parsed);
    expect(applied.get("items/test-charm.yaml")).toBe("id: test-charm\n");
    expect(applied.get("items/net.yaml")).toBeNull();
  });

  it("rejects malformed packs", () => {
    expect(() => parsePack("not json")).toThrowError(ConfigError);
    expect(() => parsePack(JSON.stringify({ kind: "nope" }))).toThrowError(ConfigError);
    expect(() =>
      parsePack(JSON.stringify({ kind: "som-config-pack", version: 1, name: "", files: {} })),
    ).toThrowError(ConfigError);
  });

  it("applies pack files onto an existing overlay", () => {
    const overlay: ConfigOverlay = new Map([["items/a.yaml", "old"]]);
    const pack = createPack("P", new Map([["items/a.yaml", "new"]]), null);
    const next = applyPackToOverlay(overlay, pack);
    expect(next.get("items/a.yaml")).toBe("new");
    // original map untouched
    expect(overlay.get("items/a.yaml")).toBe("old");
  });
});

describe("overlay stores", () => {
  it("round-trips overlays through the memory fallback", () => {
    const store = new OverlayStore(`test-overlay-${Date.now()}`);
    expect(store.isEmpty()).toBe(true);
    const overlay: ConfigOverlay = new Map([
      ["items/x.yaml", "id: x"],
      ["items/y.yaml", null],
    ]);
    store.save(overlay);
    expect(store.isEmpty()).toBe(false);
    const loaded = store.load();
    expect(loaded.get("items/x.yaml")).toBe("id: x");
    expect(loaded.get("items/y.yaml")).toBeNull();
    store.clear();
    expect(store.isEmpty()).toBe(true);
  });

  it("round-trips revisions", () => {
    const store = new RevisionStore(`test-rev-${Date.now()}`);
    expect(store.load()).toBeNull();
    store.save(7);
    expect(store.load()).toBe(7);
    store.clear();
    expect(store.load()).toBeNull();
  });
});
