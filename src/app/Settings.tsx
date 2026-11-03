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
          <h2>Save export</h2>
          <button className="secondary compact" onClick={refreshExport}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Copy this JSON to back up all characters.
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
