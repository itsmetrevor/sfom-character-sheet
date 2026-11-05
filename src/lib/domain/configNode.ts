// Node-only config loading for tests and tooling. Never imported by the app
// bundle (which fetches over HTTP instead).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { buildGameData, GameData, type ConfigFileMap } from "./config.js";

/** Read every YAML file under root into a config-relative path -> text map. */
export function readDirFileMap(root: string): ConfigFileMap {
  const files: ConfigFileMap = new Map();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) {
        walk(join(dir, name.name));
        continue;
      }
      if (!name.name.endsWith(".yaml")) continue;
      const full = join(dir, name.name);
      const rel = relative(root, full).split(sep).join("/");
      files.set(rel, readFileSync(full, "utf8"));
    }
  };
  walk(root);
  return files;
}

export async function loadGameDataFromDir(root: string): Promise<GameData> {
  return buildGameData(readDirFileMap(root));
}
