// Node-only config loader for tests and tooling. Never imported by the app
// bundle (which uses GameData.loadRuntime over fetch instead).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { assembleGameData, GameData, type RawGameFiles } from "./config.js";

function parseFile(path: string): unknown {
  return parseYaml(readFileSync(path, "utf8"));
}

function parseDir(dir: string): unknown[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => join(dir, name));
  return files.map(parseFile);
}

export function loadRawGameFiles(root: string): RawGameFiles {
  const rulesDir = join(root, "rules");
  return {
    enums: parseFile(join(root, "_enums.yaml")),
    ancestries: parseDir(join(root, "ancestries")),
    backgrounds: parseDir(join(root, "backgrounds")),
    classes: parseDir(join(root, "classes")),
    items: parseDir(join(root, "items")),
    expertise: parseFile(join(root, "expertise.yaml")),
    languages: parseFile(join(root, "languages.yaml")),
    visionTypes: parseFile(join(root, "vision-types.yaml")),
    requirements: parseFile(join(root, "requirements.yaml")),
    rules: {
      baseStats: parseFile(join(rulesDir, "base-stats.yaml")),
      creationSteps: parseFile(join(rulesDir, "creation-steps.yaml")),
      hybridAncestries: parseFile(join(rulesDir, "hybrid-ancestries.yaml")),
      partyLevels: parseFile(join(rulesDir, "party-levels.yaml")),
      statShapes: parseFile(join(rulesDir, "stat-shapes.yaml")),
      classProgression: parseFile(join(rulesDir, "class-progression.yaml")),
      combat: parseFile(join(rulesDir, "combat.yaml")),
      inventory: parseFile(join(rulesDir, "inventory.yaml")),
      startingGear: parseFile(join(rulesDir, "starting-gear.yaml")),
      statusEffects: parseFile(join(rulesDir, "status-effects.yaml")),
      economy: parseFile(join(rulesDir, "economy.yaml")),
    },
    characterTemplate: parseFile(join(root, "_character_template.yaml")),
  };
}

export function loadGameDataFromDir(root: string): GameData {
  return new GameData(assembleGameData(loadRawGameFiles(root)));
}
