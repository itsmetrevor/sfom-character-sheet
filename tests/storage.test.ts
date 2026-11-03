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

function template() {
  return loadGameDataFromDir(CONFIG_DIR).characterTemplate;
}

describe("character storage", () => {
  it("memory store round-trips characters", () => {
    const store = new MemoryStore();
    const character = template();

    expect(store.list()).toEqual([]);
    store.save(character);

    expect(store.get(character.id)).toEqual(character);
    expect(store.list()).toHaveLength(1);

    store.remove(character.id);
    expect(store.list()).toEqual([]);
  });

  it("saving the same id replaces instead of duplicating", () => {
    const store = new MemoryStore();
    const character = template();
    store.save(character);

    store.save({ ...character, name: "Renamed" });

    const characters = store.list();
    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe("Renamed");
  });

  it("rejects unsupported schema versions", () => {
    const store = new MemoryStore();
    const character = { ...template(), schemaVersion: SCHEMA_VERSION + 1 };

    expect(() => store.save(character)).toThrowError(StorageError);
    try {
      store.save(character);
    } catch (error) {
      expect((error as StorageError).kind).toBe("unsupported-version");
    }
  });

  it("character JSON round-trips", () => {
    const character = template();
    expect(characterFromJson(characterToJson(character))).toEqual(character);
  });

  it("exports and imports characters", () => {
    const source = new MemoryStore();
    const character = template();
    source.save(character);

    const exported = source.exportJson();
    expect(exported).toContain("Jimmy John");

    const destination = new MemoryStore();
    expect(destination.importJson(exported)).toBe(1);
    expect(destination.list()).toEqual([character]);
  });

  it("import accepts a single character object", () => {
    const character = template();
    const store = new MemoryStore();

    expect(store.importJson(characterToJson(character))).toBe(1);
    expect(store.list()).toHaveLength(1);
  });

  it("import rejects malformed JSON", () => {
    const store = new MemoryStore();
    expect(() => store.importJson("not json")).toThrowError(StorageError);
  });

  it("app store works without browser storage", () => {
    const store = new AppStore();
    const character = template();
    store.save(character);
    expect(store.list()).toEqual([character]);
    store.remove(character.id);
    expect(store.list()).toEqual([]);
  });
});
