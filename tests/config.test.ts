import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  characterFromWire,
  characterToWire,
} from "../src/lib/domain/character.js";
import { loadGameDataFromDir } from "../src/lib/domain/configNode.js";
import type { ConfigIndex } from "../src/lib/domain/config.js";

const ROOT = process.cwd();
const CONFIG_DIR = join(ROOT, "public/config");

async function game() {
  return loadGameDataFromDir(CONFIG_DIR);
}

describe("runtime config", () => {
  it("loads expected entities", async () => {
    const g = await game();

    expect(g.ancestries).toHaveLength(12);
    expect(g.backgrounds).toHaveLength(30);
    expect(g.classes).toHaveLength(30);
    expect(g.items).toHaveLength(35);
    expect(g.expertise).toHaveLength(18);
    expect(g.languages).toHaveLength(12);
    expect(g.visionTypes).toHaveLength(4);
    expect(g.classes.some((c) => c.id === "shard-bearer")).toBe(false);
    expect(g.expertise.some((e) => e.id === "any")).toBe(false);
  });

  it("starters connect to every tier-1 class", async () => {
    const g = await game();
    const starters = g.classes.filter((c) => c.tier === "starter");
    const tierOne = g.classes.filter((c) => c.tier === "tier-1");

    expect(starters).toHaveLength(6);
    expect(tierOne).toHaveLength(6);

    const tierOneIds = new Set(tierOne.map((c) => c.id));
    for (const starter of starters) {
      const unlocked = new Set(g.classesUnlockedBy(starter.id).map((c) => c.id));
      for (const id of tierOneIds) {
        expect(unlocked.has(id), `${starter.id} should unlock every tier-1 class`).toBe(true);
      }
    }
  });

  it("classes have required structure", async () => {
    const g = await game();
    for (const cls of g.classes) {
      for (const slot of ["main-hand", "armor", "off-hand"] as const) {
        expect(cls.equipment[slot], `${cls.id} is missing equipment slot ${slot}`).toBeDefined();
      }
      expect(cls.actions.length, `${cls.id} has no actions`).toBeGreaterThan(0);
      expect(cls.passives.length, `${cls.id} has no passives`).toBeGreaterThan(0);
      expect(
        cls.actions.every((a) => a.tags.length > 0),
        `${cls.id} has an untagged action`,
      ).toBe(true);
      for (const prerequisite of cls.prerequisites) {
        if (prerequisite.kind === "class") {
          expect(g.class(prerequisite.class!), `${cls.id} references unknown ${prerequisite.class}`).toBeDefined();
        } else {
          expect(cls.tier).toBe("tier-1");
        }
      }
    }
  });

  it("wires rules and enums", async () => {
    const g = await game();

    expect(g.rules.classProgression.classLevelMax).toBe(20);
    expect(g.rules.partyLevels.backgroundAbilityTiers).toEqual([0, 3, 6, 9]);
    expect(g.rules.partyLevels.statPips.maxPerMainStat).toBe(2);
    expect(g.rules.combat.ultimate.chargeSlots).toBe(10);
    expect(g.rules.inventory.inventoryMax).toBe(12);
    expect(g.rules.inventory.stackMax).toBe(5);
    expect(g.rules.startingGear.status).toBe("placeholder");
    expect(g.rules.startingGear.bundles).toEqual([]);
    expect(g.rules.statusEffects.status).toBe("placeholder");
    expect(g.rules.statusEffects.effects).toEqual([]);

    expect(new Set(g.enums.requirementKinds)).toEqual(new Set(Object.keys(g.requirements)));
    expect(g.enums.requirementKinds).toContain("class-level");
    expect(g.enums.requirementKinds).toContain("party-level");
  });

  it("template is valid and round-trips", async () => {
    const g = await game();
    const template = g.characterTemplate;

    expect(template.schemaVersion).toBe(1);
    expect(template.name).toBe("Jimmy John");
    expect(template.mainClass).toBe("scholar");
    expect(template.statPips["mnd"]).toBe(2);

    const parsed = characterFromWire(characterToWire(template));
    expect(parsed).toEqual(template);
  });

  it("template references existing content", async () => {
    const g = await game();
    const template = g.characterTemplate;

    expect(g.ancestry(template.ancestry.primary)).toBeDefined();
    for (const background of template.backgrounds) {
      const definition = g.background(background.background);
      expect(definition, "template background should exist").toBeDefined();
      for (const chosen of background.chosenAbilities) {
        expect(
          definition!.passives.some((p) => p.name === chosen.ability),
        ).toBe(true);
      }
    }
    for (const track of template.classes) {
      const definition = g.class(track.class);
      expect(definition, "template class should exist").toBeDefined();
      for (const action of track.unlockedActions) {
        expect(definition!.actions.some((a) => a.name === action)).toBe(true);
      }
      for (const passive of track.unlockedPassives) {
        expect(definition!.passives.some((p) => p.name === passive)).toBe(true);
      }
    }
    for (const entry of template.inventory) {
      if (entry.item) {
        expect(g.item(entry.item), `unknown item ${entry.item}`).toBeDefined();
      }
    }
  });

  it("web config index matches runtime files", async () => {
    const index = JSON.parse(
      readFileSync(join(CONFIG_DIR, "index.json"), "utf8"),
    ) as ConfigIndex;

    for (const value of Object.values(index.core)) {
      expect(existsSync(join(CONFIG_DIR, value)), `missing core file ${value}`).toBe(true);
    }
    for (const [directory, files] of Object.entries(index.entities)) {
      const listed = new Set(files);
      const actual = new Set(
        readdirSync(join(CONFIG_DIR, directory))
          .filter((name) => name.endsWith(".yaml")),
      );
      expect(listed, `index mismatch for ${directory}`).toEqual(actual);
    }
    for (const value of Object.values(index.rules)) {
      expect(
        existsSync(join(CONFIG_DIR, "rules", value)),
        `missing rule file ${value}`,
      ).toBe(true);
    }
  });
});
