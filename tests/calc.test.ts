import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { deriveCharacter } from "../src/lib/domain/calc.js";
import type { CharacterV1 } from "../src/lib/domain/character.js";
import { loadGameDataFromDir } from "../src/lib/domain/configNode.js";

const CONFIG_DIR = join(process.cwd(), "public/config");

async function game() {
  return loadGameDataFromDir(CONFIG_DIR);
}

function blankCharacter(mainClass: string): CharacterV1 {
  return {
    schemaVersion: 1,
    id: "calc-test",
    name: "Calc Test",
    notes: "",
    mainClass,
    ancestry: { primary: "enatt", hybrid: null },
    backgrounds: [],
    classes: [
      {
        class: mainClass,
        role: "main",
        level: 1,
        x: 1,
        unlockedActions: [],
        unlockedPassives: [],
      },
    ],
    partyLevel: 0,
    statPips: {},
    resources: { currentHp: 0, energy: 0, exhaustion: 0 },
    statuses: [],
    equipment: { mainHand: null, armor: null, offHand: null, accessories: [] },
    inventory: [],
    currency: { gold: 0, shards: 0 },
    passiveSlots: { nonCombat: [], combat: [] },
    overrides: { maxHp: null },
  };
}

describe("deriveCharacter", () => {
  it("derives fixture scholar stats", async () => {
    const g = await game();
    const derived = deriveCharacter(g, g.characterTemplate);

    expect(derived.maxHp).toBe(39);
    expect(derived.main["str"]).toBe(1);
    expect(derived.main["dex"]).toBe(1);
    expect(derived.main["con"]).toBe(2);
    expect(derived.main["mnd"]).toBe(5);
    expect(derived.main["int"]).toBe(2);
    expect(derived.main["luk"]).toBe(1);

    expect(derived.bonus["jmp"]).toBe(1);
    expect(derived.bonus["agl"]).toBe(5);
    expect(derived.bonus["def"]).toBe(13);
    expect(derived.bonus["res"]).toBe(14);
    expect(derived.bonus["nrg"]).toBe(1);
    expect(derived.bonus["for"]).toBe(2);

    expect(derived.expertise["crafting"]).toBe(2);
    expect(derived.expertise["knowledge"]).toBe(1);
    expect(derived.expertise["perception"]).toBe(1);
    expect(derived.expertise["resistance"]).toBe(2);
    expect(derived.expertise["strength"]).toBe(0);
  });

  it("applies double-con and equipment", async () => {
    const g = await game();
    const character = blankCharacter("gladiator");
    character.equipment.armor = "bronze-armor";

    const derived = deriveCharacter(g, character);

    expect(derived.main["con"]).toBe(4);
    expect(derived.maxHp).toBe(52);
    expect(derived.bonus["def"]).toBe(16);
    expect(derived.bonus["res"]).toBe(12);
    expect(derived.bonus["for"]).toBe(2);
    expect(derived.expertise["resistance"]).toBe(2);
    expect(derived.notes.some((n) => n.includes("double-con"))).toBe(true);
  });

  it("lets manual max-hp override win", async () => {
    const g = await game();
    const character = blankCharacter("gladiator");
    character.overrides.maxHp = 99;

    const derived = deriveCharacter(g, character);

    expect(derived.maxHp).toBe(99);
    expect(derived.notes.some((n) => n.includes("manual override"))).toBe(true);
  });

  it("respects class level for class expertise unlocks", async () => {
    const g = await game();
    const character = blankCharacter("gladiator");
    character.classes[0].level = 4;

    const derived = deriveCharacter(g, character);

    expect(derived.expertise["constitution"]).toBe(1);
    expect(derived.expertise["throw-catch"]).toBe(1);
  });
});
