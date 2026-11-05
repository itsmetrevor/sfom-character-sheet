import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  characterFromJson,
  characterToJson,
} from "../src/lib/domain/storage.js";
import { SCHEMA_VERSION } from "../src/lib/domain/character.js";
import { loadGameDataFromDir } from "../src/lib/domain/configNode.js";
import {
  AppStore,
  MemoryStore,
  StorageError,
} from "../src/lib/domain/storage.js";

const CONFIG_DIR = join(process.cwd(), "public/config");

async function template() {
  const game = await loadGameDataFromDir(CONFIG_DIR);
  return game.characterTemplate;
}

describe("character storage", () => {
  it("memory store round-trips characters", async () => {
    const store = new MemoryStore();
    const character = await template();

    expect(store.list()).toEqual([]);
    store.save(character);

    expect(store.get(character.id)).toEqual(character);
    expect(store.list()).toHaveLength(1);

    store.remove(character.id);
    expect(store.list()).toEqual([]);
  });

  it("saving the same id replaces instead of duplicating", async () => {
    const store = new MemoryStore();
    const character = await template();
    store.save(character);

    store.save({ ...character, name: "Renamed" });

    const characters = store.list();
    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe("Renamed");
  });

  it("rejects unsupported schema versions", async () => {
    const store = new MemoryStore();
    const character = { ...await template(), schemaVersion: SCHEMA_VERSION + 1 };

    expect(() => store.save(character)).toThrowError(StorageError);
    try {
      store.save(character);
    } catch (error) {
      expect((error as StorageError).kind).toBe("unsupported-version");
    }
  });

  it("character JSON round-trips", async () => {
    const character = await template();
    expect(characterFromJson(characterToJson(character))).toEqual(character);
  });

  it("exports and imports characters", async () => {
    const source = new MemoryStore();
    const character = await template();
    source.save(character);

    const exported = source.exportJson();
    expect(exported).toContain("Jimmy John");

    const destination = new MemoryStore();
    expect(destination.importJson(exported)).toBe(1);
    expect(destination.list()).toEqual([character]);
  });

  it("import accepts a single character object", async () => {
    const character = await template();
    const store = new MemoryStore();

    expect(store.importJson(characterToJson(character))).toBe(1);
    expect(store.list()).toHaveLength(1);
  });

  it("import rejects malformed JSON", async () => {
    const store = new MemoryStore();
    expect(() => store.importJson("not json")).toThrowError(StorageError);
  });

  it("app store works without browser storage", async () => {
    const store = new AppStore();
    const character = await template();
    store.save(character);
    expect(store.list()).toEqual([character]);
    store.remove(character.id);
    expect(store.list()).toEqual([]);
  });
});
