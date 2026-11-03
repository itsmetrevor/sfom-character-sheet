import {
  characterFromWire,
  characterToWire,
  SCHEMA_VERSION,
  type CharacterV1,
} from "./character.js";

export const STORAGE_KEY = "som-v3.characters.v1";

export class StorageError extends Error {
  readonly kind: "unavailable" | "unsupported-version" | "backend" | "json";
  readonly version?: number;

  constructor(
    kind: "unavailable" | "unsupported-version" | "backend" | "json",
    message: string,
    version?: number,
  ) {
    super(message);
    this.name = "StorageError";
    this.kind = kind;
    if (version !== undefined) this.version = version;
  }

  static unavailable(): StorageError {
    return new StorageError("unavailable", "browser storage is unavailable");
  }

  static unsupportedVersion(version: number): StorageError {
    return new StorageError(
      "unsupported-version",
      `unsupported character schema version: ${version}`,
      version,
    );
  }

  static backend(message: string): StorageError {
    return new StorageError("backend", `storage backend error: ${message}`);
  }

  static json(message: string): StorageError {
    return new StorageError("json", `could not encode or decode character data: ${message}`);
  }
}

export interface CharacterStore {
  list(): CharacterV1[];
  save(character: CharacterV1): void;
  remove(id: string): void;
  get(id: string): CharacterV1 | undefined;
  exportJson(): string;
  importJson(json: string): number;
}

function sorted(characters: Iterable<CharacterV1>): CharacterV1[] {
  return [...characters].sort((a, b) => a.name.localeCompare(b.name));
}

function ensureVersion(character: CharacterV1): void {
  if (character.schemaVersion !== SCHEMA_VERSION) {
    throw StorageError.unsupportedVersion(character.schemaVersion);
  }
}

function parseCharacter(value: unknown): CharacterV1 {
  try {
    return characterFromWire(value);
  } catch (error) {
    throw StorageError.json(error instanceof Error ? error.message : String(error));
  }
}

function parseImportPayload(json: string): CharacterV1[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw StorageError.json(error instanceof Error ? error.message : String(error));
  }
  const raws = Array.isArray(parsed) ? parsed : [parsed];
  return raws.map(parseCharacter);
}

/** In-memory store. Used by tests and as a fallback. */
export class MemoryStore implements CharacterStore {
  private characters = new Map<string, CharacterV1>();

  list(): CharacterV1[] {
    return sorted(this.characters.values());
  }

  save(character: CharacterV1): void {
    ensureVersion(character);
    this.characters.set(character.id, character);
  }

  remove(id: string): void {
    this.characters.delete(id);
  }

  get(id: string): CharacterV1 | undefined {
    return this.characters.get(id);
  }

  exportJson(): string {
    return JSON.stringify(this.list().map(characterToWire), null, 2);
  }

  importJson(json: string): number {
    const characters = parseImportPayload(json);
    for (const character of characters) ensureVersion(character);
    for (const character of characters) this.save(character);
    return characters.length;
  }
}

function readLocalStorageMap(): Map<string, CharacterV1> {
  const storage = globalThis.localStorage;
  if (!storage) throw StorageError.unavailable();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw StorageError.json(error instanceof Error ? error.message : String(error));
  }
  const map = new Map<string, CharacterV1>();
  if (parsed && typeof parsed === "object") {
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      const character = parseCharacter(value);
      map.set(character.id, character);
    }
  }
  return map;
}

function writeLocalStorageMap(map: Map<string, CharacterV1>): void {
  const storage = globalThis.localStorage;
  if (!storage) throw StorageError.unavailable();
  const raw: Record<string, unknown> = {};
  for (const [id, character] of map) raw[id] = characterToWire(character);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch (error) {
    throw StorageError.backend(error instanceof Error ? error.message : String(error));
  }
}

/** Browser localStorage store. Mirrors the Rust WebStore wire shape. */
export class LocalStorageStore implements CharacterStore {
  list(): CharacterV1[] {
    return sorted(readLocalStorageMap().values());
  }

  save(character: CharacterV1): void {
    ensureVersion(character);
    const map = readLocalStorageMap();
    map.set(character.id, character);
    writeLocalStorageMap(map);
  }

  remove(id: string): void {
    const map = readLocalStorageMap();
    map.delete(id);
    writeLocalStorageMap(map);
  }

  get(id: string): CharacterV1 | undefined {
    return readLocalStorageMap().get(id);
  }

  exportJson(): string {
    return JSON.stringify(
      this.list().map(characterToWire),
      null,
      2,
    );
  }

  importJson(json: string): number {
    const characters = parseImportPayload(json);
    for (const character of characters) ensureVersion(character);
    const map = readLocalStorageMap();
    for (const character of characters) map.set(character.id, character);
    writeLocalStorageMap(map);
    return characters.length;
  }
}

interface CapacitorFilesystem {
  readFile(options: { path: string; directory: unknown; encoding?: string }): Promise<{ data: string }>;
  writeFile(options: { path: string; data: string; directory: unknown; encoding?: string; recursive?: boolean }): Promise<void>;
}

async function loadCapacitorFilesystem(): Promise<CapacitorFilesystem | null> {
  try {
    const core = await import("@capacitor/core");
    const { Filesystem } = await import("@capacitor/filesystem");
    if (!core.Capacitor.isNativePlatform()) return null;
    return Filesystem as unknown as CapacitorFilesystem;
  } catch {
    return null;
  }
}

/**
 * Native file store for Capacitor builds (Android/iOS). Falls back to
 * localStorage when the native Filesystem API is unavailable (web/PWA).
 */
export class FileStore implements CharacterStore {
  constructor(
    private readonly path = ".som-v3/characters.json",
    private readonly fallback: CharacterStore = new LocalStorageStore(),
  ) {}

  private get native(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (globalThis as any).Capacitor;
      return !!cap?.isNativePlatform?.();
    } catch {
      return false;
    }
  }

  list(): CharacterV1[] {
    if (!this.native) return this.fallback.list();
    throw StorageError.unavailable();
  }

  save(character: CharacterV1): void {
    ensureVersion(character);
    if (!this.native) {
      this.fallback.save(character);
      return;
    }
    throw StorageError.unavailable();
  }

  remove(id: string): void {
    if (!this.native) {
      this.fallback.remove(id);
      return;
    }
    throw StorageError.unavailable();
  }

  get(id: string): CharacterV1 | undefined {
    if (!this.native) return this.fallback.get(id);
    throw StorageError.unavailable();
  }

  exportJson(): string {
    if (!this.native) return this.fallback.exportJson();
    throw StorageError.unavailable();
  }

  importJson(json: string): number {
    if (!this.native) return this.fallback.importJson(json);
    throw StorageError.unavailable();
  }

  async listAsync(): Promise<CharacterV1[]> {
    const fs = await loadCapacitorFilesystem();
    if (!fs) return this.fallback.list();
    const { Directory } = await import("@capacitor/filesystem");
    try {
      const result = await fs.readFile({
        path: this.path,
        directory: Directory.Data,
        encoding: "utf8",
      });
      const parsed = JSON.parse(result.data as string) as Record<string, unknown>;
      const characters: CharacterV1[] = [];
      for (const value of Object.values(parsed)) {
        characters.push(parseCharacter(value));
      }
      return sorted(characters);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("does not exist") || message.includes("ENOENT")) return [];
      throw StorageError.backend(message);
    }
  }

  async saveAsync(character: CharacterV1): Promise<void> {
    ensureVersion(character);
    const fs = await loadCapacitorFilesystem();
    if (!fs) {
      this.fallback.save(character);
      return;
    }
    const { Directory } = await import("@capacitor/filesystem");
    const characters = await this.listAsync();
    const map: Record<string, unknown> = {};
    for (const c of characters) map[c.id] = characterToWire(c);
    map[character.id] = characterToWire(character);
    try {
      await fs.writeFile({
        path: this.path,
        data: JSON.stringify(map, null, 2),
        directory: Directory.Data,
        encoding: "utf8",
        recursive: true,
      });
    } catch (error) {
      throw StorageError.backend(error instanceof Error ? error.message : String(error));
    }
  }
}

/** Default app store: native file store with localStorage fallback. */
export class AppStore implements CharacterStore {
  private readonly inner: CharacterStore;

  constructor() {
    try {
      this.inner = new LocalStorageStore();
      // Probe availability; fall back to memory when storage is blocked.
      this.inner.list();
    } catch {
      this.inner = new MemoryStore();
    }
  }

  list(): CharacterV1[] {
    return this.inner.list();
  }

  save(character: CharacterV1): void {
    this.inner.save(character);
  }

  remove(id: string): void {
    this.inner.remove(id);
  }

  get(id: string): CharacterV1 | undefined {
    return this.inner.get(id);
  }

  exportJson(): string {
    return this.inner.exportJson();
  }

  importJson(json: string): number {
    return this.inner.importJson(json);
  }
}

export function characterToJson(character: CharacterV1): string {
  return JSON.stringify(characterToWire(character));
}

export function characterFromJson(json: string): CharacterV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw StorageError.json(error instanceof Error ? error.message : String(error));
  }
  return parseCharacter(parsed);
}
