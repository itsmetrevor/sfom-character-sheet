import { useMemo, useRef, useState } from "react";
import {
  buildGameData,
  createPack,
  fileProvenance,
  type ConfigFileMap,
  type ConfigOverlay,
  type ConfigPack,
  type FileProvenance,
} from "../lib/domain/index.js";

export type FileRecords = Record<string, string>;
export type OverlayRecords = Record<string, string | null>;

export function recordsToMap(records: FileRecords | OverlayRecords): ConfigFileMap {
  return new Map(Object.entries(records)) as ConfigFileMap;
}

export function overlayToMap(records: OverlayRecords): ConfigOverlay {
  return new Map(Object.entries(records));
}


function provenanceLabel(provenance: FileProvenance): string {
  switch (provenance) {
    case "official":
      return "OFFICIAL";
    case "upstream":
      return "UPDATED";
    case "modified":
      return "MODIFIED";
    case "added":
      return "ADDED";
    case "deleted":
      return "DELETED";
  }
}

const SCAFFOLDS: Record<string, { label: string; filename: string; body: string }> = {
  ancestries: {
    label: "Ancestry",
    filename: "my-ancestry.yaml",
    body: [
      "id: my-ancestry",
      "name: My Ancestry",
      "languages:",
      "  - common",
      "vision: normal",
      "stat-modifiers: {}",
      "expertise-modifiers: []",
      "passives: []",
      "lore: {}",
      "",
    ].join("\n"),
  },
  backgrounds: {
    label: "Background",
    filename: "my-background.yaml",
    body: [
      "id: my-background",
      "name: My Background",
      "craftsman: false",
      "description: TODO",
      "expertise-modifiers: []",
      "starting-items: []",
      "passives: []",
      "",
    ].join("\n"),
  },
  classes: {
    label: "Class",
    filename: "my-class.yaml",
    body: [
      "id: my-class",
      "name: My Class",
      "roles: [dps]",
      "main-stat: str",
      "tier: starter",
      "x-start: 1",
      "max-hp-mode: normal",
      "prerequisites: []",
      "expertise-modifiers: []",
      "stat-modifiers: {}",
      "equipment:",
      "  main-hand: Weapon",
      "  armor: Light Armor",
      "  off-hand: Shield",
      "combat-modifier:",
      "  name: TODO",
      "  description: TODO",
      "ultimate:",
      "  name: TODO",
      "  description: TODO",
      "  charge:",
      "    - TODO",
      "passives: []",
      "actions: []",
      "",
    ].join("\n"),
  },
  items: {
    label: "Item",
    filename: "my-item.yaml",
    body: [
      "id: my-item",
      "name: My Item",
      "slot: item",
      "damage-type: none",
      "effect: TODO",
      "stack-max: 1",
      "",
    ].join("\n"),
  },
};

export interface UpstreamPanelState {
  status: "idle" | "checking" | "available" | "uptodate" | "error";
  detail: string | null;
  availableRevision: number | null;
  onCheck: () => Promise<void>;
  onApply: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export function ConfigManager(props: {
  baseFiles: FileRecords;
  upstreamFiles: OverlayRecords;
  userFiles: OverlayRecords;
  baseRevision: number | null;
  upstreamRevision: number | null;
  onCommitUser: (next: OverlayRecords) => Promise<void>;
  onResetUser: () => Promise<void>;
  onImportPackText: (text: string) => Promise<{ applied: number; warnings: string[] }>;
  upstream: UpstreamPanelState;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mergedPaths = useMemo(() => {
    const paths = new Set<string>([
      ...Object.keys(props.baseFiles),
      ...Object.keys(props.upstreamFiles),
      ...Object.keys(props.userFiles),
    ]);
    return [...paths].sort();
  }, [props.baseFiles, props.upstreamFiles, props.userFiles]);

  const baseMap = useMemo(() => recordsToMap(props.baseFiles), [props.baseFiles]);

  if (selected) {
    return (
      <FileEditor
        path={selected}
        baseFiles={props.baseFiles}
        upstreamFiles={props.upstreamFiles}
        userFiles={props.userFiles}
        baseMap={baseMap}
        onBack={() => {
          setSelected(null);
          setNotice(null);
        }}
        onCommitUser={props.onCommitUser}
        notice={notice}
        setNotice={setNotice}
      />
    );
  }

  return (
    <>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <h2>Official updates</h2>
        </div>
        <p className="muted small">
          Bundled revision: {props.baseRevision ?? "unknown"}
          {props.upstreamRevision != null && ` · updates revision: ${props.upstreamRevision}`}
        </p>
        <UpstreamPanel upstream={props.upstream} setNotice={setNotice} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Share packs</h2>
        </div>
        <PackExport
          userFiles={props.userFiles}
          baseRevision={props.baseRevision}
          setNotice={setNotice}
        />
        <PackImport onImportPackText={props.onImportPackText} setNotice={setNotice} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Game files</h2>
          <button className="secondary compact" onClick={() => setCreating(true)}>
            New file
          </button>
        </div>
        {creating && (
          <CreateFileForm
            mergedPaths={mergedPaths}
            userFiles={props.userFiles}
            onCommitUser={props.onCommitUser}
            onClose={() => setCreating(false)}
            onCreated={(path) => {
              setCreating(false);
              setSelected(path);
            }}
            setNotice={setNotice}
          />
        )}
        <FileBrowser
          mergedPaths={mergedPaths}
          baseFiles={props.baseFiles}
          upstreamFiles={props.upstreamFiles}
          userFiles={props.userFiles}
          onSelect={(path) => {
            setSelected(path);
            setNotice(null);
          }}
        />
        <div className="button-row">
          <button
            className="danger compact"
            onClick={async () => {
              if (
                !window.confirm(
                  "Delete all custom content and restore official files?",
                )
              ) {
                return;
              }
              try {
                await props.onResetUser();
                setNotice("Custom content cleared.");
              } catch (error) {
                setNotice(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Reset all custom content
          </button>
        </div>
      </section>
    </>
  );
}

function UpstreamPanel(props: {
  upstream: UpstreamPanelState;
  setNotice: (message: string | null) => void;
}) {
  const { upstream } = props;
  return (
    <>
      {upstream.detail && <p className="muted small">{upstream.detail}</p>}
      <div className="button-row">
        <button
          className="secondary compact"
          disabled={upstream.status === "checking"}
          onClick={async () => {
            try {
              await upstream.onCheck();
            } catch (error) {
              props.setNotice(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          {upstream.status === "checking" ? "Checking…" : "Check for updates"}
        </button>
        {upstream.status === "available" && (
          <button
            className="primary compact"
            onClick={async () => {
              try {
                await upstream.onApply();
                props.setNotice(
                  `Official updates applied (revision ${upstream.availableRevision ?? "?"}).`,
                );
              } catch (error) {
                props.setNotice(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Download updates
          </button>
        )}
        <button
          className="secondary compact"
          onClick={async () => {
            try {
              await upstream.onRemove();
              props.setNotice("Official updates removed.");
            } catch (error) {
              props.setNotice(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          Remove updates
        </button>
      </div>
    </>
  );
}

function PackExport(props: {
  userFiles: OverlayRecords;
  baseRevision: number | null;
  setNotice: (message: string | null) => void;
}) {
  const [name, setName] = useState("my-pack");
  const [author, setAuthor] = useState("");
  const count = Object.keys(props.userFiles).length;
  return (
    <div className="form-grid add-row">
      <label className="field">
        <span>Pack name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Author (optional)</span>
        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <button
        className="secondary"
        disabled={count === 0}
        onClick={() => {
          const overlay = overlayToMap(props.userFiles);
          const pack = createPack(
            name.trim() === "" ? "my-pack" : name.trim(),
            overlay,
            props.baseRevision,
            author.trim(),
          );
          const blob = new Blob([JSON.stringify(pack, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${pack.name}.sompack.json`;
          link.click();
          URL.revokeObjectURL(url);
          props.setNotice(`Exported ${count} file(s) as "${pack.name}".`);
        }}
      >
        Export pack ({count})
      </button>
    </div>
  );
}

function PackImport(props: {
  onImportPackText: (text: string) => Promise<{ applied: number; warnings: string[] }>;
  setNotice: (message: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="form-grid add-row">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const text = await file.text();
            const result = await props.onImportPackText(text);
            props.setNotice(
              [`Imported ${result.applied} file(s).`, ...result.warnings].join(" "),
            );
          } catch (error) {
            props.setNotice(error instanceof Error ? error.message : String(error));
          }
        }}
      />
      <button className="secondary" onClick={() => fileRef.current?.click()}>
        Import pack file
      </button>
    </div>
  );
}

function groupOf(path: string): string {
  const slash = path.indexOf("/");
  if (slash < 0) return "core";
  return path.slice(0, slash);
}

function FileBrowser(props: {
  mergedPaths: string[];
  baseFiles: FileRecords;
  upstreamFiles: OverlayRecords;
  userFiles: OverlayRecords;
  onSelect: (path: string) => void;
}) {
  const baseMap = useMemo(() => recordsToMap(props.baseFiles), [props.baseFiles]);
  const upstreamMap = useMemo(() => overlayToMap(props.upstreamFiles), [props.upstreamFiles]);
  const userMap = useMemo(() => overlayToMap(props.userFiles), [props.userFiles]);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const path of props.mergedPaths) {
      const group = groupOf(path);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(path);
    }
    return [...map.entries()];
  }, [props.mergedPaths]);

  return (
    <>
      {groups.map(([group, paths]) => (
        <div key={group}>
          <h3 className="section-title">{group}</h3>
          <div className="level-list">
            {paths.map((path) => {
              const provenance = fileProvenance(baseMap, upstreamMap, userMap, path);
              const filename = path.includes("/") ? path.slice(path.indexOf("/") + 1) : path;
              return (
                <div className="level-row" key={path}>
                  <button
                    className="secondary compact"
                    style={{ textAlign: "left" }}
                    onClick={() => props.onSelect(path)}
                  >
                    {filename}
                  </button>
                  <span className="pill">{provenanceLabel(provenance)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function CreateFileForm(props: {
  mergedPaths: string[];
  userFiles: OverlayRecords;
  onCommitUser: (next: OverlayRecords) => Promise<void>;
  onClose: () => void;
  onCreated: (path: string) => void;
  setNotice: (message: string | null) => void;
}) {
  const [kind, setKind] = useState<keyof typeof SCAFFOLDS>("classes");
  const [filename, setFilename] = useState(SCAFFOLDS.classes.filename);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="track-card">
      <div className="form-grid">
        <label className="field">
          <span>Kind</span>
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as keyof typeof SCAFFOLDS;
              setKind(next);
              setFilename(SCAFFOLDS[next].filename);
            }}
          >
            {Object.entries(SCAFFOLDS).map(([key, scaffold]) => (
              <option key={key} value={key}>
                {scaffold.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Filename</span>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="my-thing.yaml"
          />
        </label>
      </div>
      {error && (
        <div className="notice danger-notice" role="alert">
          {error}
        </div>
      )}
      <div className="button-row">
        <button
          className="primary compact"
          onClick={async () => {
            const clean = filename.trim();
            if (!/^[a-z0-9-]+\.yaml$/.test(clean)) {
              setError("Filename must be lowercase letters, digits, dashes, ending in .yaml.");
              return;
            }
            const path = `${kind}/${clean}`;
            if (props.mergedPaths.includes(path) && !(path in props.userFiles)) {
              // mergedPaths includes user files too; block any collision.
              setError(`${path} already exists.`);
              return;
            }
            if (path in props.userFiles) {
              setError(`${path} already exists in your custom content.`);
              return;
            }
            try {
              await props.onCommitUser({ ...props.userFiles, [path]: SCAFFOLDS[kind].body });
              props.onCreated(path);
            } catch (commitError) {
              setError(
                commitError instanceof Error ? commitError.message : String(commitError),
              );
            }
          }}
        >
          Create and edit
        </button>
        <button className="secondary compact" onClick={props.onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function FileEditor(props: {
  path: string;
  baseFiles: FileRecords;
  upstreamFiles: OverlayRecords;
  userFiles: OverlayRecords;
  baseMap: ConfigFileMap;
  onBack: () => void;
  onCommitUser: (next: OverlayRecords) => Promise<void>;
  notice: string | null;
  setNotice: (message: string | null) => void;
}) {
  const effectiveText = useMemo(() => {
    if (props.path in props.userFiles) {
      return (props.userFiles[props.path] ?? "") as string;
    }
    if (props.path in props.upstreamFiles) {
      return (props.upstreamFiles[props.path] ?? "") as string;
    }
    return props.baseFiles[props.path] ?? "";
  }, [props.path, props.userFiles, props.upstreamFiles, props.baseFiles]);
  const [draft, setDraft] = useState(effectiveText);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const upstreamMap = useMemo(() => overlayToMap(props.upstreamFiles), [props.upstreamFiles]);
  const userMap = useMemo(() => overlayToMap(props.userFiles), [props.userFiles]);
  const provenance = fileProvenance(props.baseMap, upstreamMap, userMap, props.path);
  const isTombstoned = props.userFiles[props.path] === null;
  const isBaseFile = props.path in props.baseFiles;

  const commit = async (next: OverlayRecords) => {
    setError(null);
    setSaved(false);
    // Validate by building the game before persisting.
    const candidateOverlay: ConfigOverlay = new Map(Object.entries(next));
    try {
      await buildGameData(props.baseMap, [upstreamMap, candidateOverlay]);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : String(validationError));
      return;
    }
    try {
      await props.onCommitUser(next);
      setSaved(true);
      props.setNotice(`Saved ${props.path}.`);
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : String(commitError));
    }
  };

  return (
    <>
      <section className="panel sheet-header">
        <div>
          <p className="eyebrow">Edit config file</p>
          <h2 style={{ overflowWrap: "anywhere" }}>{props.path}</h2>
          <p className="muted">
            Layer: {provenanceLabel(provenance)}
            {isTombstoned ? " · deleted by you" : ""}
          </p>
        </div>
        <div className="button-row">
          <button className="secondary compact" onClick={props.onBack}>
            Back to files
          </button>
        </div>
      </section>

      {props.notice && (
        <div className="notice" role="status">
          {props.notice}
        </div>
      )}
      {error && (
        <div className="notice danger-notice" role="alert" style={{ whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="notice" role="status">
          Saved and applied.
        </div>
      )}

      {isTombstoned ? (
        <section className="panel">
          <p className="muted">This file is deleted in your custom content.</p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => {
                const next = { ...props.userFiles };
                delete next[props.path];
                void commit(next);
              }}
            >
              Restore file
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <textarea
            className="code-area"
            rows={24}
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
          />
          <div className="button-row">
            <button
              className="primary"
              onClick={() => void commit({ ...props.userFiles, [props.path]: draft })}
            >
              Save and apply
            </button>
            <button
              className="secondary"
              onClick={() => {
                setDraft(effectiveText);
                setError(null);
                setSaved(false);
              }}
            >
              Revert edits
            </button>
            {isBaseFile ? (
              <button
                className="danger"
                onClick={() => void commit({ ...props.userFiles, [props.path]: null })}
              >
                Delete file
              </button>
            ) : (
              <button
                className="danger"
                onClick={() => {
                  const next = { ...props.userFiles };
                  delete next[props.path];
                  void commit(next).then(() => props.onBack());
                }}
              >
                Delete file
              </button>
            )}
          </div>
          <p className="muted small">
            Saving validates the whole game. Failures keep the last working version.
          </p>
        </section>
      )}
    </>
  );
}

export function packWarnings(
  pack: ConfigPack,
  baseRevision: number | null,
): string[] {
  const warnings: string[] = [];
  if (
    pack.baseRevision !== undefined &&
    pack.baseRevision !== null &&
    baseRevision !== null &&
    pack.baseRevision !== baseRevision
  ) {
    warnings.push(
      `Pack was built for content revision ${pack.baseRevision}; this app has ${baseRevision}.`,
    );
  }
  return warnings;
}
