import { useState } from "react";
import { AppStore, GameData } from "../lib/domain/index.js";

export function SettingsScreen(props: {
  game: GameData;
  store: AppStore;
  onImported: () => void;
  onReloadGameData: () => void;
}) {
  const { game, store } = props;
  const [exportText, setExportText] = useState(() => safeExport(store));
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refreshExport = () => setExportText(safeExport(store));

  const runImport = () => {
    if (importText.trim() === "") {
      setMessage("Paste character JSON first.");
      return;
    }
    try {
      const count = store.importJson(importText);
      setMessage(`Imported ${count} character(s).`);
      setExportText(safeExport(store));
      props.onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <h2>Data status</h2>
          <button className="secondary compact" onClick={props.onReloadGameData}>
            Reload game data
          </button>
        </div>
        <p className="muted small">
          Edit YAML under public/config and reload — no rebuild needed. Code
          changes hot-reload via Vite.
        </p>
        <dl className="detail-list">
          <div>
            <dt>Schema</dt>
            <dd>v{game.characterTemplate.schemaVersion}</dd>
          </div>
          <div>
            <dt>Config</dt>
            <dd>runtime config/ · edit and reload</dd>
          </div>
          <div>
            <dt>Starting gear</dt>
            <dd>
              {game.rules.startingGear.status}: {game.rules.startingGear.missingSource}
            </dd>
          </div>
          <div>
            <dt>Status effects</dt>
            <dd>
              {game.rules.statusEffects.status}: {game.rules.statusEffects.missingSource}
            </dd>
          </div>
          <div>
            <dt>Class unlock model</dt>
            <dd>{game.rules.classProgression.unlockModel.abilities}</dd>
          </div>
          <div>
            <dt>X growth</dt>
            <dd>
              {game.rules.combat.x.growth} ({game.rules.combat.x.growthFormula})
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Save export</h2>
          <button className="secondary compact" onClick={refreshExport}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Copy this JSON to back up all characters. Saves are also kept locally
          under som-v3.characters.v1.
        </p>
        <textarea
          className="code-area"
          rows={10}
          readOnly
          value={exportText}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Import characters</h2>
        </div>
        <p className="muted">
          Paste an exported array or a single character object. Importing
          replaces characters with the same id.
        </p>
        <textarea
          className="code-area"
          rows={8}
          placeholder="Paste character JSON here"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <div className="button-row">
          <button className="primary" onClick={runImport}>
            Import
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Install and offline</h2>
        </div>
        <p className="muted">
          Use the browser&apos;s Install app or Add to Home Screen action.
          After the first load, the service worker caches the app shell for
          offline use.
        </p>
        <p className="muted small">
          Bump CACHE_VERSION in public/sw.js whenever the shell changes.
        </p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Storage</h2>
        </div>
        <p className="muted">
          Web builds save to localStorage under som-v3.characters.v1. Native
          builds (Capacitor) save a JSON file in the app data directory via the
          Filesystem API. Export/import works without a server.
        </p>
        <p className="muted small">
          Native builds use Capacitor (`npx cap sync` + `npx cap open android`
          / `ios`); the Android/iOS SDKs live outside this repo.
        </p>
        <p className="muted small">Architecture: ARCHITECTURE.md · Agent guide: AGENTS.md</p>
      </section>
    </>
  );
}

function safeExport(store: AppStore): string {
  try {
    return store.exportJson();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
