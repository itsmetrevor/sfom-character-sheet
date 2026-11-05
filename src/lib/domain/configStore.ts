import type { ConfigOverlay } from "./config.js";

export const USER_OVERLAY_KEY = "som-v3.config-user.v1";
export const UPSTREAM_OVERLAY_KEY = "som-v3.config-upstream.v1";
export const UPSTREAM_REVISION_KEY = "som-v3.config-upstream-revision.v1";

interface StoredOverlay {
  files: Record<string, string | null>;
}

/**
 * Persists a config overlay (user edits / cached official updates).
 * Web + Capacitor both use localStorage here: overlays are small deltas, and
 * the same JSON shape round-trips everywhere. Falls back to memory when
 * storage is unavailable (private mode, tests).
 */
export class OverlayStore {
  private memory: StoredOverlay | null = null;

  constructor(private readonly key: string) {}

  private storage(): globalThis.Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  load(): ConfigOverlay {
    const storage = this.storage();
    if (!storage) {
      return new Map(Object.entries(this.memory?.files ?? {}));
    }
    const raw = storage.getItem(this.key);
    if (!raw) return new Map();
    try {
      const parsed = JSON.parse(raw) as StoredOverlay;
      if (typeof parsed !== "object" || parsed === null || typeof parsed.files !== "object") {
        return new Map();
      }
      return new Map(Object.entries(parsed.files));
    } catch {
      return new Map();
    }
  }

  save(overlay: ConfigOverlay): void {
    const files: Record<string, string | null> = {};
    for (const [path, value] of overlay) files[path] = value;
    const payload: StoredOverlay = { files };
    const storage = this.storage();
    if (!storage) {
      this.memory = payload;
      return;
    }
    storage.setItem(this.key, JSON.stringify(payload));
  }

  clear(): void {
    const storage = this.storage();
    if (!storage) {
      this.memory = null;
      return;
    }
    storage.removeItem(this.key);
  }

  isEmpty(): boolean {
    return this.load().size === 0;
  }
}

export class RevisionStore {
  private memory: number | null = null;

  constructor(private readonly key: string) {}

  load(): number | null {
    try {
      const storage = globalThis.localStorage ?? null;
      if (!storage) return this.memory;
      const raw = storage.getItem(this.key);
      if (raw == null) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch {
      return this.memory;
    }
  }

  save(revision: number | null): void {
    try {
      const storage = globalThis.localStorage ?? null;
      if (!storage) {
        this.memory = revision;
        return;
      }
      if (revision == null) storage.removeItem(this.key);
      else storage.setItem(this.key, String(revision));
    } catch {
      this.memory = revision;
    }
  }

  clear(): void {
    this.save(null);
  }
}
