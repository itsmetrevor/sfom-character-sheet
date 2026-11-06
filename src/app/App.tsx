import { useCallback, useEffect, useMemo, useState } from "react";
import { deriveCharacter } from "../lib/domain/calc.js";
import { slugify, type CharacterV1 } from "../lib/domain/character.js";
import {
  AppStore,
  GameData,
  MAIN_STATS,
  BONUS_STATS,
  applyPackToOverlay,
  fetchBaseFileMap,
  fetchIndexRevision,
  fetchUpstreamSnapshot,
  parsePack,
  UPSTREAM_BASE_URL,
  OverlayStore,
  RevisionStore,
  USER_OVERLAY_KEY,
  UPSTREAM_OVERLAY_KEY,
  UPSTREAM_REVISION_KEY,
  type Action,
  type Background,
  type Class,
  type ConfigPack,
  type InventoryEntry,
} from "../lib/domain/index.js";
import { CharacterEditor } from "./Editor.js";
import { SettingsScreen } from "./Settings.js";
import {
  ConfigManager,
  packWarnings,
  type FileRecords,
  type OverlayRecords,
  type UpstreamPanelState,
} from "./ConfigManager.js";
import {
  ancestryLabel,
  backgroundAbilityAt,
  backgroundLabel,
  classInitials,
  classLabel,
  classLevel,
  equipmentValue,
  expertiseSummary,
  inventoryName,
  languageText,
  modifierSummary,
  roleText,
  subclassLabel,
  tierLabel,
} from "./format.js";

export type Screen =
  | "main-menu"
  | "choose-character"
  | "create-character"
  | "character-menu"
  | "character-sheet"
  | "classes"
  | "expertise"
  | "abilities"
  | "edit-character"
  | "options"
  | "manage-data";

type CreateStep = "ancestry" | "background" | "info" | "class" | "review";

const CLASS_TIERS = ["starter", "tier-1", "tier-2", "tier-3", "tier-4"] as const;

function recordsToMap<T extends string | null>(
  records: Record<string, T>,
): Map<string, T> {
  return new Map(Object.entries(records)) as Map<string, T>;
}

export function App() {
  const [game, setGame] = useState<GameData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseFiles, setBaseFiles] = useState<FileRecords | null>(null);
  const [userFiles, setUserFiles] = useState<OverlayRecords>({});
  const [upstreamFiles, setUpstreamFiles] = useState<OverlayRecords>({});
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [cachedUpstreamRevision, setCachedUpstreamRevision] = useState<number | null>(null);
  const [upstreamStatus, setUpstreamStatus] = useState<{
    status: "idle" | "checking" | "available" | "uptodate" | "error";
    detail: string | null;
    availableRevision: number | null;
  }>({ status: "idle", detail: null, availableRevision: null });
  const store = useMemo(() => new AppStore(), []);
  const userStore = useMemo(() => new OverlayStore(USER_OVERLAY_KEY), []);
  const upstreamStore = useMemo(() => new OverlayStore(UPSTREAM_OVERLAY_KEY), []);
  const revisionStore = useMemo(() => new RevisionStore(UPSTREAM_REVISION_KEY), []);
  const [characters, setCharacters] = useState<CharacterV1[]>(() => {
    try {
      return store.list();
    } catch (error) {
      return [];
    }
  });
  const [initialNotice] = useState<string | null>(() => {
    try {
      store.list();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [screen, setScreen] = useState<Screen>("main-menu");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const rebuildWith = useCallback(
    async (base: FileRecords, upstream: OverlayRecords, user: OverlayRecords) => {
      setGame(
        await GameData.assemble(recordsToMap(base), [
          recordsToMap(upstream),
          recordsToMap(user),
        ]),
      );
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setGame(null);
    setLoadError(null);
    try {
      const baseUrl = `${import.meta.env.BASE_URL}config`;
      const [baseMap, revision] = await Promise.all([
        fetchBaseFileMap(baseUrl),
        fetchIndexRevision(baseUrl).catch(() => null),
      ]);
      const baseRec: FileRecords = Object.fromEntries(baseMap);
      const user = userStore.load();
      const upstream = upstreamStore.load();
      const userRec: OverlayRecords = Object.fromEntries(user);
      const upstreamRec: OverlayRecords = Object.fromEntries(upstream);
      setBaseFiles(baseRec);
      setBaseRevision(revision);
      setUserFiles(userRec);
      setUpstreamFiles(upstreamRec);
      setCachedUpstreamRevision(revisionStore.load());
      try {
        await rebuildWith(baseRec, upstreamRec, userRec);
      } catch (overlayError) {
        // Custom content broke against the fresh base: fall back to official.
        await rebuildWith(baseRec, {}, {});
        setNotice(
          `Custom content failed to apply and was skipped: ${
            overlayError instanceof Error ? overlayError.message : String(overlayError)
          } Open Manage data to fix or reset it.`,
        );
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [rebuildWith, userStore, upstreamStore, revisionStore]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Dev live-reload: the Vite config plugin sends this when YAML changes.
  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const handler = () => {
      void loadAll();
    };
    hot.on("som-config-changed", handler);
    return () => {
      hot.off("som-config-changed", handler);
    };
  }, [loadAll]);

  const refresh = useCallback(() => {
    try {
      setCharacters(store.list());
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [store]);

  const updateCharacter = useCallback(
    (updated: CharacterV1) => {
      try {
        store.save(updated);
        setCharacters(store.list());
        setNotice(null);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [store],
  );

  const onCommitUser = useCallback(
    async (next: OverlayRecords) => {
      if (!baseFiles) throw new Error("Base config is not loaded yet.");
      const candidate = recordsToMap(next);
      const rebuilt = await GameData.assemble(recordsToMap(baseFiles), [
        recordsToMap(upstreamFiles),
        candidate,
      ]);
      userStore.save(candidate);
      setUserFiles(next);
      setGame(rebuilt);
    },
    [baseFiles, upstreamFiles, userStore],
  );

  const onResetUser = useCallback(async () => {
    if (!baseFiles) return;
    userStore.clear();
    const next: OverlayRecords = {};
    setUserFiles(next);
    await rebuildWith(baseFiles, upstreamFiles, next);
  }, [baseFiles, upstreamFiles, rebuildWith, userStore]);

  const onImportPackText = useCallback(
    async (text: string): Promise<{ applied: number; warnings: string[] }> => {
      const pack: ConfigPack = parsePack(text);
      const warnings = packWarnings(pack, baseRevision);
      const merged = applyPackToOverlay(recordsToMap(userFiles), pack);
      const next: OverlayRecords = Object.fromEntries(merged);
      await onCommitUser(next);
      return { applied: Object.keys(pack.files).length, warnings };
    },
    [userFiles, baseRevision, onCommitUser],
  );

  const upstreamPanel: UpstreamPanelState = useMemo(
    () => ({
      status: upstreamStatus.status,
      detail:
        upstreamStatus.detail ??
        (cachedUpstreamRevision != null
          ? `Cached official updates at revision ${cachedUpstreamRevision}.`
          : upstreamStatus.status === "uptodate"
            ? "Bundled config matches the official source."
            : "Check whether the handbook authors published changes."),
      availableRevision: upstreamStatus.availableRevision,
      onCheck: async () => {
        setUpstreamStatus({ status: "checking", detail: null, availableRevision: null });
        try {
          const revision = await fetchIndexRevision(UPSTREAM_BASE_URL);
          if (revision == null) {
            setUpstreamStatus({
              status: "error",
              detail: "The official source did not advertise a revision.",
              availableRevision: null,
            });
          } else if (baseRevision != null && revision > baseRevision) {
            setUpstreamStatus({
              status: "available",
              detail: `Official revision ${revision} is available (bundled: ${baseRevision}).`,
              availableRevision: revision,
            });
          } else {
            setUpstreamStatus({
              status: "uptodate",
              detail: `Official revision ${revision ?? "unknown"} matches the bundle.`,
              availableRevision: revision,
            });
          }
        } catch (error) {
          setUpstreamStatus({
            status: "error",
            detail: error instanceof Error ? error.message : String(error),
            availableRevision: null,
          });
        }
      },
      onApply: async () => {
        const snapshot = await fetchUpstreamSnapshot(UPSTREAM_BASE_URL);
        if (!baseFiles) throw new Error("Base config is not loaded yet.");
        // Store only files that differ from the bundle to keep the delta small.
        const delta: OverlayRecords = {};
        for (const [path, text] of snapshot.files) {
          if (baseFiles[path] !== text) delta[path] = text;
        }
        upstreamStore.save(recordsToMap(delta));
        revisionStore.save(snapshot.revision);
        setUpstreamFiles(delta);
        setCachedUpstreamRevision(snapshot.revision);
        await rebuildWith(baseFiles, delta, userFiles);
        setUpstreamStatus({
          status: "uptodate",
          detail: `Official updates applied (revision ${snapshot.revision ?? "unknown"}).`,
          availableRevision: snapshot.revision,
        });
      },
      onRemove: async () => {
        upstreamStore.clear();
        revisionStore.clear();
        setUpstreamFiles({});
        setCachedUpstreamRevision(null);
        if (baseFiles) await rebuildWith(baseFiles, {}, userFiles);
        setUpstreamStatus({
          status: "idle",
          detail: null,
          availableRevision: null,
        });
      },
    }),
    [
      upstreamStatus,
      cachedUpstreamRevision,
      baseRevision,
      baseFiles,
      userFiles,
      rebuildWith,
      upstreamStore,
      revisionStore,
    ],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      try {
        store.remove(id);
        setCharacters(store.list());
        setNotice(null);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
        return;
      }
      setSelectedId(null);
      setScreen("choose-character");
    },
    [store],
  );

  const selected =
    selectedId == null
      ? null
      : (characters.find((c) => c.id === selectedId) ?? null);

  return (
    <div className="app-shell">
      <AppHeader
        screen={screen}
        onBack={(target) => setScreen(target)}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />
      {menuOpen && (
        <div className="menu-overlay">
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="menu-drawer" aria-label="Main navigation">
            <button
              onClick={() => {
                setScreen("main-menu");
                setMenuOpen(false);
              }}
            >
              MAIN MENU
            </button>
            <button
              onClick={() => {
                setScreen("choose-character");
                setMenuOpen(false);
              }}
            >
              CHOOSE CHARACTER
            </button>
            <button
              onClick={() => {
                setScreen("create-character");
                setMenuOpen(false);
              }}
            >
              CREATE CHARACTER
            </button>
            <button
              onClick={() => {
                setScreen("options");
                setMenuOpen(false);
              }}
            >
              OPTIONS
            </button>
            <button className="drawer-close" onClick={() => setMenuOpen(false)}>
              CLOSE
            </button>
          </nav>
        </div>
      )}
      <main className="content">
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {game == null ? (
          loadError == null ? (
            <section className="panel loading-panel">
              <h2>Loading game data...</h2>
              <p className="muted">Reading runtime YAML from config/.</p>
            </section>
          ) : (
            <section className="panel error-panel">
              <h2>Config failed to load</h2>
              <pre className="error-text">{loadError}</pre>
              <div className="button-row">
                <button className="secondary" onClick={() => void loadAll()}>
                  RETRY
                </button>
              </div>
            </section>
          )
        ) : (
          <ScreenBody
            screen={screen}
            game={game}
            store={store}
            characters={characters}
            selected={selected}
            onSelect={(id) => {
              setSelectedId(id);
              setScreen("character-menu");
            }}
            onNavigate={setScreen}
            onSaved={(id) => {
              refresh();
              setSelectedId(id);
              setScreen("character-menu");
            }}
            onEditorSaved={(id) => {
              refresh();
              setSelectedId(id);
              setScreen("character-sheet");
            }}
            onUpdate={updateCharacter}
            onDelete={deleteCharacter}
            onImported={refresh}
            onManage={() => setScreen("manage-data")}
            baseFiles={baseFiles}
            userFiles={userFiles}
            upstreamFiles={upstreamFiles}
            baseRevision={baseRevision}
            cachedUpstreamRevision={cachedUpstreamRevision}
            onCommitUser={onCommitUser}
            onResetUser={onResetUser}
            onImportPackText={onImportPackText}
            upstreamPanel={upstreamPanel}
          />
        )}
      </main>
    </div>
  );
}

function headerInfo(screen: Screen): { title: string; back: Screen | null } {
  switch (screen) {
    case "main-menu":
      return { title: "MAIN MENU", back: null };
    case "choose-character":
      return { title: "CHOOSE CHARACTER", back: "main-menu" };
    case "create-character":
      return { title: "CREATE CHARACTER", back: "main-menu" };
    case "character-menu":
      return { title: "CHARACTER MENU", back: "choose-character" };
    case "character-sheet":
      return { title: "CHARACTER SHEET", back: "character-menu" };
    case "classes":
      return { title: "CLASSES", back: "character-menu" };
    case "expertise":
      return { title: "EXPERTISE", back: "character-menu" };
    case "abilities":
      return { title: "ABILITIES", back: "character-menu" };
    case "edit-character":
      return { title: "EDIT CHARACTER", back: "character-menu" };
    case "options":
      return { title: "OPTIONS", back: "main-menu" };
    case "manage-data":
      return { title: "MANAGE DATA", back: "options" };
  }
}

function AppHeader(props: {
  screen: Screen;
  onBack: (target: Screen) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const { title, back } = headerInfo(props.screen);
  return (
    <header className="app-header">
      <div className="header-slot">
        {back && (
          <button
            className="icon-button"
            aria-label="Back"
            onClick={() => props.onBack(back)}
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 18 14">
                <path
                  d="M11 1 L4 7 L11 13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                />
              </svg>
            </span>
          </button>
        )}
      </div>
      <h1 className="header-title">{title}</h1>
      <div className="header-slot right">
        <button
          className="icon-button menu-toggle"
          aria-label="Menu"
          onClick={props.onToggleMenu}
        >
          <svg viewBox="0 0 18 14" aria-hidden="true">
            <rect x="0" y="0" width="18" height="3" fill="currentColor" />
            <rect x="0" y="5.5" width="18" height="3" fill="currentColor" />
            <rect x="0" y="11" width="18" height="3" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function ScreenBody(props: {
  screen: Screen;
  game: GameData;
  store: AppStore;
  characters: CharacterV1[];
  selected: CharacterV1 | null;
  onSelect: (id: string) => void;
  onNavigate: (screen: Screen) => void;
  onSaved: (id: string) => void;
  onEditorSaved: (id: string) => void;
  onUpdate: (character: CharacterV1) => void;
  onDelete: (id: string) => void;
  onImported: () => void;
  onManage: () => void;
  baseFiles: FileRecords | null;
  userFiles: OverlayRecords;
  upstreamFiles: OverlayRecords;
  baseRevision: number | null;
  cachedUpstreamRevision: number | null;
  onCommitUser: (next: OverlayRecords) => Promise<void>;
  onResetUser: () => Promise<void>;
  onImportPackText: (text: string) => Promise<{ applied: number; warnings: string[] }>;
  upstreamPanel: UpstreamPanelState;
}) {
  const { screen, game, selected } = props;
  switch (screen) {
    case "main-menu":
      return <MainMenu onNavigate={props.onNavigate} />;
    case "choose-character":
      return (
        <ChooseCharacterScreen
          game={game}
          characters={props.characters}
          onOpen={props.onSelect}
          onNew={() => props.onNavigate("create-character")}
        />
      );
    case "create-character":
      return (
        <CreateCharacterScreen game={game} store={props.store} onSaved={props.onSaved} />
      );
    case "options":
      return (
        <SettingsScreen
          store={props.store}
          onImported={props.onImported}
          onManage={() => props.onNavigate("manage-data")}
        />
      );
    case "manage-data":
      return (
        <ConfigManager
          baseFiles={props.baseFiles ?? {}}
          upstreamFiles={props.upstreamFiles}
          userFiles={props.userFiles}
          baseRevision={props.baseRevision}
          upstreamRevision={props.cachedUpstreamRevision}
          onCommitUser={props.onCommitUser}
          onResetUser={props.onResetUser}
          onImportPackText={props.onImportPackText}
          upstream={props.upstreamPanel}
        />
      );
    case "character-menu":
    case "character-sheet":
    case "classes":
    case "expertise":
    case "abilities":
    case "edit-character":
      if (!selected) {
        return (
          <section className="panel empty-state">
            <h2>No character selected</h2>
            <p className="muted">Choose or create a character first.</p>
            <button
              className="primary"
              onClick={() => props.onNavigate("choose-character")}
            >
              CHOOSE CHARACTER
            </button>
          </section>
        );
      }
      switch (screen) {
        case "character-menu":
          return (
            <CharacterMenuScreen
              game={game}
              character={selected}
              onChange={props.onUpdate}
              onNav={props.onNavigate}
              onEdit={() => props.onNavigate("edit-character")}
              onDelete={props.onDelete}
            />
          );
        case "character-sheet":
          return (
            <CharacterSheetScreen
              game={game}
              character={selected}
              onChange={props.onUpdate}
              onEdit={() => props.onNavigate("edit-character")}
              onDelete={props.onDelete}
            />
          );
        case "classes":
          return (
            <ClassesScreen
              game={game}
              character={selected}
              onChange={props.onUpdate}
              onEdit={() => props.onNavigate("edit-character")}
            />
          );
        case "expertise":
          return (
            <ExpertiseScreen
              game={game}
              character={selected}
              onChange={props.onUpdate}
              onEdit={() => props.onNavigate("edit-character")}
            />
          );
        case "abilities":
          return (
            <AbilitiesScreen
              game={game}
              character={selected}
              onChange={props.onUpdate}
              onEdit={() => props.onNavigate("edit-character")}
            />
          );
        case "edit-character":
          return (
            <CharacterEditor
              game={game}
              character={selected}
              store={props.store}
              onSaved={props.onEditorSaved}
              onCancel={() => props.onNavigate("character-menu")}
            />
          );
      }
  }
}

function MainMenu(props: { onNavigate: (screen: Screen) => void }) {
  return (
    <section className="main-menu">
      <div className="logo">
        <img
          className="logo-image"
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Shard - Fragments of Memory"
        />
      </div>
      <div className="menu-stack">
        <button
          className="menu-action strong"
          onClick={() => props.onNavigate("create-character")}
        >
          CREATE CHARACTER
        </button>
        <button
          className="menu-action strong"
          onClick={() => props.onNavigate("choose-character")}
        >
          CHOOSE CHARACTER
        </button>
        <button
          className="menu-action strong"
          onClick={() => props.onNavigate("options")}
        >
          OPTIONS
        </button>
      </div>
    </section>
  );
}

function ChooseCharacterScreen(props: {
  game: GameData;
  characters: CharacterV1[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <>
      <section className="character-list">
        {props.characters.length === 0 ? (
          <div className="empty-box">
            <p>NO CHARACTERS YET</p>
            <p className="muted">Create a Fragment to begin.</p>
          </div>
        ) : (
          props.characters.map((character) => (
            <button
              key={character.id}
              className="character-card"
              onClick={() => props.onOpen(character.id)}
            >
              <div className="pic-box">PIC</div>
              <div className="character-card-info">
                <strong>{character.name}</strong>
                <span>
                  {ancestryLabel(props.game, character)} /{" "}
                  {backgroundLabel(props.game, character)}
                </span>
                <span>
                  {classLabel(props.game, character)} /{" "}
                  {subclassLabel(props.game, character)}
                </span>
              </div>
            </button>
          ))
        )}
      </section>
      <button className="menu-action quiet" onClick={props.onNew}>
        NEW CHARACTER
      </button>
    </>
  );
}

export function VitalsHeader(props: {
  character: CharacterV1;
  maxHp: number;
  onChange: (character: CharacterV1) => void;
  onEdit: () => void;
}) {
  const { character, maxHp, onChange, onEdit } = props;
  const hp = character.resources.currentHp;
  const energy = character.resources.energy;
  const exhaustion = character.resources.exhaustion;

  const patchResources = (patch: Partial<CharacterV1["resources"]>) =>
    onChange({
      ...character,
      resources: { ...character.resources, ...patch },
    });

  return (
    <section className="vitals">
      <div className="vitals-row">
        <div className="vital-card health">
          <span className="vital-label">HEALTH POINTS</span>
          <div className="vital-value">
            {hp} / {maxHp}
          </div>
        </div>
        <div className="vital-card">
          <span className="vital-label">ENERGY</span>
          <div className="vital-value">{energy}</div>
        </div>
        <div className="vital-card">
          <span className="vital-label">EXHAUSTION</span>
          <div className="vital-value">{exhaustion}</div>
        </div>
      </div>
      <div className="vitals-controls">
        <div className="vital-control">
          <div className="source-pills">
            <span className="source-pill">P</span>
            <span className="source-pill">C</span>
            <span className="source-pill">T</span>
          </div>
          <div className="stepper">
            <button
              onClick={() =>
                patchResources({ currentHp: Math.max(0, hp - 1) })
              }
            >
              −
            </button>
            <button
              onClick={() =>
                patchResources({ currentHp: Math.min(maxHp, hp + 1) })
              }
            >
              +
            </button>
          </div>
        </div>
        <div className="vital-control">
          <div className="stepper">
            <button
              onClick={() => patchResources({ energy: Math.max(0, energy - 1) })}
            >
              −
            </button>
            <button onClick={() => patchResources({ energy: energy + 1 })}>
              +
            </button>
          </div>
        </div>
        <div className="vital-control">
          <div className="stepper">
            <button
              onClick={() =>
                patchResources({ exhaustion: Math.max(0, exhaustion - 1) })
              }
            >
              −
            </button>
            <button
              onClick={() => patchResources({ exhaustion: exhaustion + 1 })}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="status-line">
        <span className="status-label">STATUS EFFECTS / BONUSES</span>
        <button className="circle-button" aria-label="Edit statuses" onClick={onEdit}>
          +
        </button>
        {character.statuses.map((status) => (
          <span key={status.id} className="status-chip">
            {status.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function CharacterMenuScreen(props: {
  game: GameData;
  character: CharacterV1;
  onChange: (character: CharacterV1) => void;
  onNav: (screen: Screen) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const derived = deriveCharacter(props.game, props.character);
  const id = props.character.id;
  return (
    <>
      <VitalsHeader
        character={props.character}
        maxHp={derived.maxHp}
        onChange={props.onChange}
        onEdit={props.onEdit}
      />
      <section className="character-menu-list">
        <button className="menu-row" onClick={() => props.onNav("character-sheet")}>
          <span className="menu-circle" />
          <span className="menu-label">CHARACTER SHEET</span>
        </button>
        <button className="menu-row" onClick={() => props.onNav("classes")}>
          <span className="menu-circle" />
          <span className="menu-label">CLASSES</span>
        </button>
        <button className="menu-row" onClick={() => props.onNav("expertise")}>
          <span className="menu-circle" />
          <span className="menu-label">EXPERTISE</span>
        </button>
        <button className="menu-row" onClick={() => props.onNav("abilities")}>
          <span className="menu-circle" />
          <span className="menu-label">ABILITIES</span>
        </button>
      </section>
      <div className="button-row menu-actions">
        <button className="secondary compact" onClick={props.onEdit}>
          EDIT CHARACTER
        </button>
        <button className="danger compact" onClick={() => props.onDelete(id)}>
          DELETE
        </button>
      </div>
    </>
  );
}

function equipmentRow(
  game: GameData,
  label: string,
  value: string | null,
  key: string,
) {
  return (
    <div className="equipment-row" key={key}>
      <span className="equipment-circle" />
      <span className="equipment-label">{label}</span>
      <span className="equipment-value">{equipmentValue(game, value)}</span>
    </div>
  );
}

function CharacterSheetScreen(props: {
  game: GameData;
  character: CharacterV1;
  onChange: (character: CharacterV1) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const { game, character, onChange } = props;
  const derived = deriveCharacter(game, character);
  const level = classLevel(character);
  const maxClassLevel = game.rules.classProgression.classLevelMax;
  const stackMax = game.rules.inventory.stackMax;
  const id = character.id;

  const levelUpMain = () => {
    onChange({
      ...character,
      classes: character.classes.map((track) =>
        track.role === "main"
          ? { ...track, level: Math.min(maxClassLevel, track.level + 1) }
          : track,
      ),
    });
  };
  const levelUpParty = () =>
    onChange({ ...character, partyLevel: Math.min(255, character.partyLevel + 1) });

  return (
    <>
      <VitalsHeader
        character={character}
        maxHp={derived.maxHp}
        onChange={onChange}
        onEdit={props.onEdit}
      />

      <section className="level-summary">
        <div className="level-box">
          <span className="vital-label">CLASS LEVELS</span>
          <strong>{level}</strong>
        </div>
        <div className="level-actions">
          <button className="level-button" onClick={levelUpMain}>
            CLASS LEVEL UP
          </button>
          <button className="level-button" onClick={levelUpParty}>
            PARTY LEVEL UP
          </button>
        </div>
        <div className="level-box">
          <span className="vital-label">PARTY LEVEL</span>
          <strong>{character.partyLevel}</strong>
        </div>
      </section>

      <section className="info-box">
        <span className="vital-label">CHARACTER INFO</span>
        <strong>{character.name}</strong>
        <p>
          {ancestryLabel(game, character)} / {backgroundLabel(game, character)}
        </p>
        <p>
          {classLabel(game, character)} / {subclassLabel(game, character)}
        </p>
        {character.notes !== "" && <p className="notes">{character.notes}</p>}
      </section>

      <h2 className="section-heading">MAIN STATS</h2>
      <div className="stat-box-grid">
        {MAIN_STATS.map((stat) => (
          <div className="stat-box" key={stat}>
            <span className="stat-label">{stat}</span>
            <strong className="stat-value">{derived.main[stat] ?? 0}</strong>
            <div className="source-pills small-pills">
              <span className="source-pill">P</span>
              <span className="source-pill">C</span>
              <span className="source-pill">T</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-heading">BONUS STATS</h2>
      <div className="stat-box-grid">
        {BONUS_STATS.map((stat) => (
          <div className="stat-box" key={stat}>
            <span className="stat-label">{stat}</span>
            <strong className="stat-value">{derived.bonus[stat] ?? 0}</strong>
            <div className="source-pills small-pills">
              <span className="source-pill">P</span>
              <span className="source-pill">C</span>
              <span className="source-pill">T</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-heading">EQUIPMENT</h2>
      <div className="equipment-list">
        {equipmentRow(game, "MAIN HAND", character.equipment.mainHand, "main-hand")}
        {equipmentRow(game, "OFF HAND", character.equipment.offHand, "off-hand")}
        {equipmentRow(game, "ARMOR", character.equipment.armor, "armor")}
        {character.equipment.accessories.length === 0 ? (
          <>
            {equipmentRow(game, "ACCESSORY", null, "acc-0")}
            {equipmentRow(game, "ACCESSORY", null, "acc-1")}
          </>
        ) : (
          character.equipment.accessories.map((accessory, index) =>
            equipmentRow(game, "ACCESSORY", accessory, `acc-${index}`),
          )
        )}
      </div>

      <h2 className="section-heading">ITEMS</h2>
      <div className="item-list">
        {character.inventory.length === 0
          ? [0, 1, 2].map((index) => (
              <div className="item-row" key={index}>
                <span />
                <span className="quantity">/{stackMax}</span>
              </div>
            ))
          : character.inventory.map((entry, index) => (
              <div className="item-row" key={index}>
                <span>{inventoryName(game, entry)}</span>
                <span className="quantity">
                  {entry.quantity}/{stackMax}
                </span>
              </div>
            ))}
      </div>

      <div className="button-row menu-actions">
        <button className="secondary compact" onClick={props.onEdit}>
          EDIT CHARACTER
        </button>
        <button className="danger compact" onClick={() => props.onDelete(id)}>
          DELETE
        </button>
      </div>
    </>
  );
}

function ClassesScreen(props: {
  game: GameData;
  character: CharacterV1;
  onChange: (character: CharacterV1) => void;
  onEdit: () => void;
}) {
  const derived = deriveCharacter(props.game, props.character);
  return (
    <>
      <VitalsHeader
        character={props.character}
        maxHp={derived.maxHp}
        onChange={props.onChange}
        onEdit={props.onEdit}
      />

      <div className="button-row class-select">
        <button className="level-button" onClick={props.onEdit}>
          SELECT MAIN CLASS
        </button>
        <button className="level-button" onClick={props.onEdit}>
          SELECT SUB CLASS
        </button>
      </div>

      {CLASS_TIERS.map((tier) => (
        <section className="class-tier" key={tier}>
          <h2 className="tier-heading">{tierLabel(tier)}</h2>
          <div className="class-grid">
            {props.game.classes
              .filter((cls) => cls.tier === tier)
              .map((cls) => {
                const track = props.character.classes.find((t) => t.class === cls.id);
                return (
                  <div
                    key={cls.id}
                    className={track ? "class-card current" : "class-card"}
                  >
                    <div className="class-circle">{classInitials(cls.name)}</div>
                    <span className="class-name">{cls.name}</span>
                    <span className="class-level">
                      {track ? `LEVEL: ${String(track.level).padStart(2, "0")}` : "LEVEL: --"}
                    </span>
                    {track && <span className="class-role">{track.role}</span>}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
      <p className="muted small ultimate-note">
        ULTIMATE CLASS: Shard Bearer is a choose-your-own template and is not
        tracked in v1.
      </p>
      <div className="button-row menu-actions">
        <button className="secondary compact" onClick={props.onEdit}>
          EDIT CLASS LEVELS
        </button>
      </div>
    </>
  );
}

function ExpertiseScreen(props: {
  game: GameData;
  character: CharacterV1;
  onChange: (character: CharacterV1) => void;
  onEdit: () => void;
}) {
  const derived = deriveCharacter(props.game, props.character);
  return (
    <>
      <VitalsHeader
        character={props.character}
        maxHp={derived.maxHp}
        onChange={props.onChange}
        onEdit={props.onEdit}
      />

      {MAIN_STATS.map((stat) => (
        <section className="expertise-group" key={stat}>
          <div className="group-pill">{stat} EXPERTISE</div>
          {props.game.expertise
            .filter((entry) => entry.mainStat === stat)
            .map((entry) => (
              <div className="expertise-row" key={entry.id}>
                <span className="expertise-name">{entry.name}</span>
                <div className="source-pills">
                  <span className="source-pill">S</span>
                  <span className="source-pill">P</span>
                  <span className="source-pill">C</span>
                  <span className="source-pill">T</span>
                </div>
                <span className="expertise-value">
                  {derived.expertise[entry.id as keyof typeof derived.expertise] ?? 0}
                </span>
              </div>
            ))}
        </section>
      ))}

      <div className="button-row menu-actions">
        <button className="secondary compact" onClick={props.onEdit}>
          EDIT EXPERTISE
        </button>
      </div>
    </>
  );
}

type Phase = "end-turn" | "status-step" | "end-round" | "refresh";

function phaseClass(active: boolean): string {
  return active ? "phase-button active" : "phase-button";
}

function AbilitiesScreen(props: {
  game: GameData;
  character: CharacterV1;
  onChange: (character: CharacterV1) => void;
  onEdit: () => void;
}) {
  const { game, character } = props;
  const [phase, setPhase] = useState<Phase>("end-turn");
  const derived = deriveCharacter(game, character);
  const mainClass = game.class(character.mainClass);
  const classTracks = character.classes.flatMap((track) => {
    const cls = game.class(track.class);
    return cls ? [{ track, cls }] : [];
  });

  const mainActions: { action: Action; locked: boolean }[] = [];
  const supportActions: { action: Action; locked: boolean }[] = [];
  const reactions: { action: Action; locked: boolean }[] = [];
  for (const { track, cls } of classTracks) {
    for (const action of cls.actions) {
      const locked = !track.unlockedActions.includes(action.name);
      const entry = { action, locked };
      if (action.kind === "main") mainActions.push(entry);
      else if (action.kind === "support") supportActions.push(entry);
      else reactions.push(entry);
    }
  }

  return (
    <>
      <VitalsHeader
        character={character}
        maxHp={derived.maxHp}
        onChange={props.onChange}
        onEdit={props.onEdit}
      />

      <section className="phase-tracker">
        <div className="phase-grid">
          {(
            [
              ["end-turn", "END OF TURN"],
              ["status-step", "STATUS STEP"],
              ["end-round", "END OF ROUND"],
              ["refresh", "REFRESH ABILITIES"],
            ] as [Phase, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={phaseClass(phase === value)}
              onClick={() => setPhase(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="ability-section">
        <h2 className="group-pill">ULTIMATE ABILITY</h2>
        {mainClass ? (
          <article className="ability-card">
            <strong className="ability-name">{mainClass.ultimate.name}</strong>
            <p className="ability-description">{mainClass.ultimate.description}</p>
            <p className="ability-meta">
              CHARGE: {mainClass.ultimate.charge.join(" / ")}
            </p>
          </article>
        ) : (
          <div className="empty-box">NO MAIN CLASS</div>
        )}
      </section>

      <section className="ability-section">
        <h2 className="group-pill">BACKGROUND ABILITIES</h2>
        {character.backgrounds.length === 0 ? (
          <div className="empty-box">NO BACKGROUND</div>
        ) : (
          character.backgrounds.flatMap((selection) => {
            const background = game.background(selection.background);
            if (!background) return [];
            return selection.chosenAbilities.flatMap((chosen) => {
              const passive = background.passives.find((p) => p.name === chosen.ability);
              if (!passive) return [];
              return [
                <article
                  className="ability-card"
                  key={`${selection.background}-${chosen.ability}`}
                >
                  <span className="ability-owner">
                    {background.name} / P.LVL {chosen.partyLevel}
                  </span>
                  <strong className="ability-name">{passive.name}</strong>
                  <p className="ability-description">{passive.summary}</p>
                </article>,
              ];
            });
          })
        )}
      </section>

      <section className="ability-section">
        <h2 className="group-pill">PASSIVE ABILITIES</h2>
        {game.ancestry(character.ancestry.primary)?.passives.map((passive) => (
          <article className="ability-card" key={`ancestry-${passive.name}`}>
            <span className="ability-owner">
              {game.ancestry(character.ancestry.primary)?.name} / {passive.kind}
            </span>
            <strong className="ability-name">{passive.name}</strong>
            <p className="ability-description">{passive.description}</p>
          </article>
        ))}
        {classTracks.flatMap(({ track, cls }) =>
          cls.passives.map((passive) => {
            const locked = !track.unlockedPassives.includes(passive.name);
            return (
              <article
                className={locked ? "ability-card locked" : "ability-card"}
                key={`${cls.id}-${passive.name}`}
              >
                <span className="ability-owner">
                  {cls.name} / {track.role}
                </span>
                <strong className="ability-name">{passive.name}</strong>
                {locked && <span className="lock-tag">LOCKED</span>}
                <p className="ability-description">{passive.description}</p>
              </article>
            );
          }),
        )}
        {[...character.passiveSlots.nonCombat, ...character.passiveSlots.combat].map(
          (passive) => (
            <article className="ability-card" key={`slot-${passive}`}>
              <span className="ability-owner">SLOTTED PASSIVE</span>
              <strong className="ability-name">{passive}</strong>
            </article>
          ),
        )}
      </section>

      <AbilityGroup title="MAIN ACTIONS" actions={mainActions} />
      <AbilityGroup title="SUPPORT ACTIONS" actions={supportActions} />
      <AbilityGroup title="REACTIONS" actions={reactions} />

      <div className="button-row menu-actions">
        <button className="secondary compact" onClick={props.onEdit}>
          EDIT ABILITIES
        </button>
      </div>
    </>
  );
}

function AbilityGroup(props: {
  title: string;
  actions: { action: Action; locked: boolean }[];
}) {
  return (
    <section className="ability-section">
      <h2 className="group-pill">{props.title}</h2>
      {props.actions.length === 0 ? (
        <div className="empty-box">NONE RECORDED</div>
      ) : (
        props.actions.map(({ action, locked }) => (
          <article
            className={locked ? "ability-card locked" : "ability-card"}
            key={action.name}
          >
            <span className="ability-owner">
              {action.kind} / {action.tags.join(" · ")}
            </span>
            <strong className="ability-name">{action.name}</strong>
            {locked && <span className="lock-tag">LOCKED</span>}
            <p className="ability-meta">
              {action.cost} · {action.targetRange}
            </p>
            <p className="ability-check">{action.check}</p>
            <p className="ability-description">{action.description}</p>
          </article>
        ))
      )}
    </section>
  );
}

function stepClass(active: boolean): string {
  return active ? "menu-action quiet step-active" : "menu-action quiet";
}

function CreateCharacterScreen(props: {
  game: GameData;
  store: AppStore;
  onSaved: (id: string) => void;
}) {
  const { game, store, onSaved } = props;
  const [step, setStep] = useState<CreateStep>("ancestry");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [ancestryId, setAncestryId] = useState(
    () => game.ancestries[0]?.id ?? "",
  );
  const [backgroundId, setBackgroundId] = useState(
    () => game.backgrounds[0]?.id ?? "",
  );
  const starters = game.classes.filter((cls) => cls.tier === "starter");
  const [classId, setClassId] = useState(() => starters[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const selectedAncestry = game.ancestry(ancestryId);
  const selectedBackground = game.background(backgroundId);
  const selectedClass = game.class(classId);

  const finish = () => {
    const nameValue = name.trim();
    if (nameValue === "") {
      setError("Enter a character name before finishing.");
      setStep("info");
      return;
    }
    const character = buildCharacter(
      game,
      nameValue,
      notes,
      ancestryId,
      backgroundId,
      classId,
    );
    if (!character) {
      setError("Selected content is missing from config.");
      return;
    }
    try {
      store.save(character);
      onSaved(character.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  return (
    <>
      <div className="step-menu">
        <button className={stepClass(step === "ancestry")} onClick={() => setStep("ancestry")}>
          CHOOSE ANCESTRY
        </button>
        <button
          className={stepClass(step === "background")}
          onClick={() => setStep("background")}
        >
          CHOOSE BACKGROUND
        </button>
        <button className={stepClass(step === "class")} onClick={() => setStep("class")}>
          CHOOSE STARTING CLASS
        </button>
        <button className={stepClass(step === "info")} onClick={() => setStep("info")}>
          CHARACTER INFO
        </button>
        <button className={stepClass(step === "review")} onClick={() => setStep("review")}>
          FINISH CHARACTER
        </button>
      </div>

      {error && (
        <div className="notice danger-notice" role="alert">
          {error}
        </div>
      )}

      {step === "ancestry" && (
        <section className="step-panel">
          <h2 className="section-heading">CHOOSE ANCESTRY</h2>
          <div className="field">
            <span>ANCESTRY</span>
            <select value={ancestryId} onChange={(e) => setAncestryId(e.target.value)}>
              {game.ancestries.map((ancestry) => (
                <option key={ancestry.id} value={ancestry.id}>
                  {ancestry.name}
                </option>
              ))}
            </select>
          </div>
          {selectedAncestry && (
            <div className="preview-card">
              <span className="vital-label">ANCESTRY</span>
              <strong>{selectedAncestry.name}</strong>
              <p>
                {selectedAncestry.vision} · {languageText(selectedAncestry)}
              </p>
              <p className="muted">{modifierSummary(selectedAncestry.statModifiers)}</p>
              <p className="muted">
                {expertiseSummary(selectedAncestry.expertiseModifiers, null)}
              </p>
              <ul className="plain-list">
                {selectedAncestry.passives.map((passive) => (
                  <li key={passive.name}>
                    {passive.name} ({passive.kind})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="button-row">
            <button className="primary" onClick={() => setStep("background")}>
              NEXT
            </button>
          </div>
        </section>
      )}

      {step === "background" && (
        <section className="step-panel">
          <h2 className="section-heading">CHOOSE BACKGROUND</h2>
          <div className="field">
            <span>BACKGROUND</span>
            <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)}>
              {game.backgrounds.map((background) => (
                <option key={background.id} value={background.id}>
                  {background.name}
                </option>
              ))}
            </select>
          </div>
          {selectedBackground && (
            <BackgroundPreview game={game} background={selectedBackground} />
          )}
          <div className="button-row">
            <button className="secondary" onClick={() => setStep("ancestry")}>
              BACK
            </button>
            <button className="primary" onClick={() => setStep("class")}>
              NEXT
            </button>
          </div>
        </section>
      )}

      {step === "info" && (
        <section className="step-panel">
          <h2 className="section-heading">CHARACTER INFO</h2>
          <label className="field">
            <span>NAME</span>
            <input
              type="text"
              placeholder="NAME YOUR FRAGMENT"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>NOTES</span>
            <textarea
              rows={4}
              placeholder="Backstory, appearance, goals..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button className="secondary" onClick={() => setStep("class")}>
              BACK
            </button>
            <button className="primary" onClick={() => setStep("review")}>
              NEXT
            </button>
          </div>
        </section>
      )}

      {step === "class" && (
        <section className="step-panel">
          <h2 className="section-heading">CHOOSE STARTING CLASS</h2>
          <div className="field">
            <span>STARTER CLASS</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {starters.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} · {cls.mainStat} · {roleText(cls)}
                </option>
              ))}
            </select>
          </div>
          {selectedClass && <ClassPreview cls={selectedClass} />}
          <div className="button-row">
            <button className="secondary" onClick={() => setStep("background")}>
              BACK
            </button>
            <button className="primary" onClick={() => setStep("info")}>
              NEXT
            </button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="step-panel">
          <h2 className="section-heading">FINISH CHARACTER</h2>
          <div className="info-box">
            <strong>{name}</strong>
            <p>
              {ancestryId} / {backgroundId}
            </p>
            <p>{classId}</p>
          </div>
          <div className="button-row">
            <button className="secondary" onClick={() => setStep("info")}>
              BACK
            </button>
            <button className="primary" onClick={finish}>
              CREATE CHARACTER
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function BackgroundPreview(props: { game: GameData; background: Background }) {
  const { game, background } = props;
  const items = background.startingItems
    .map((entry) => {
      const name = game.item(entry.item)?.name ?? entry.item;
      return `${name} ×${entry.quantity}`;
    })
    .join(", ");
  return (
    <div className="preview-card">
      <span className="vital-label">BACKGROUND</span>
      <strong>{background.name}</strong>
      <p className="muted">
        {expertiseSummary(background.expertiseModifiers, null)}
      </p>
      <p>STARTING ITEMS: {items === "" ? "none" : items}</p>
      <p>P.LVL 0 ABILITY: {backgroundAbilityAt(background, 0)}</p>
    </div>
  );
}

function ClassPreview(props: { cls: Class }) {
  const { cls } = props;
  return (
    <div className="preview-card">
      <span className="vital-label">STARTER CLASS</span>
      <strong>{cls.name}</strong>
      <p>
        {cls.tier} · {cls.mainStat} · {roleText(cls)}
      </p>
      <p className="muted">{modifierSummary(cls.statModifiers)}</p>
      <p>EQUIPMENT: {Object.values(cls.equipment).join(" / ")}</p>
    </div>
  );
}

function buildCharacter(
  game: GameData,
  name: string,
  notes: string,
  ancestryId: string,
  backgroundId: string,
  classId: string,
): CharacterV1 | null {
  const ancestry = game.ancestry(ancestryId);
  const background = game.background(backgroundId);
  const cls = game.class(classId);
  if (!ancestry || !background || !cls) return null;

  const chosenAbility =
    background.passives.find((passive) =>
      passive.requirements.some((r) => r.kind === "party-level" && r.level === 0),
    ) ?? background.passives[0];

  const inventory: InventoryEntry[] = background.startingItems.map((entry) => ({
    item: entry.item,
    quantity: entry.quantity,
    customName: null,
  }));

  const character: CharacterV1 = {
    schemaVersion: 1,
    id: `${slugify(name)}-${Date.now()}`,
    name,
    notes,
    mainClass: cls.id,
    ancestry: { primary: ancestry.id, hybrid: null },
    backgrounds: [
      {
        background: background.id,
        chosenAbilities: chosenAbility
          ? [{ partyLevel: 0, ability: chosenAbility.name }]
          : [],
      },
    ],
    classes: [
      {
        class: cls.id,
        role: "main",
        level: 1,
        x: cls.xStart,
        unlockedActions: [],
        unlockedPassives: [],
      },
    ],
    partyLevel: 0,
    statPips: { str: 0, dex: 0, con: 0, mnd: 0, int: 0, luk: 0 },
    resources: { currentHp: 0, energy: 0, exhaustion: 0 },
    statuses: [],
    equipment: { mainHand: null, armor: null, offHand: null, accessories: [] },
    inventory,
    currency: { gold: 0, shards: 0 },
    passiveSlots: {
      nonCombat: ancestry.passives
        .filter((p) => p.kind === "non-combat")
        .map((p) => p.name),
      combat: ancestry.passives
        .filter((p) => p.kind === "combat")
        .map((p) => p.name),
    },
    overrides: { maxHp: null },
  };

  const derived = deriveCharacter(game, character);
  character.resources.currentHp = derived.maxHp;
  return character;
}
