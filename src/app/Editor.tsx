import { useMemo, useState } from "react";
import { deriveCharacter } from "../lib/domain/calc.js";
import { slugify, type CharacterV1 } from "../lib/domain/character.js";
import {
  AppStore,
  GameData,
  MAIN_STATS,
  STATUS_KINDS,
  type InventoryEntry,
  type StatusKind,
} from "../lib/domain/index.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function CharacterEditor(props: {
  game: GameData;
  character: CharacterV1;
  store: AppStore;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { game, character } = props;
  const [draft, setDraft] = useState<CharacterV1>(() => clone(character));
  const [error, setError] = useState<string | null>(null);

  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusKind, setNewStatusKind] = useState<StatusKind>("condition");
  const [newItemId, setNewItemId] = useState(() => game.items[0]?.id ?? "");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newCustomItem, setNewCustomItem] = useState("");
  const [newCustomQty, setNewCustomQty] = useState(1);
  const [newAccessory, setNewAccessory] = useState(
    () => game.items.find((item) => item.slot === "accessory")?.id ?? "",
  );
  const [newClassId, setNewClassId] = useState(() => {
    const existing = new Set(character.classes.map((t) => t.class));
    return game.classes.find((cls) => !existing.has(cls.id))?.id ?? "";
  });
  const [newNonCombat, setNewNonCombat] = useState("");
  const [newCombat, setNewCombat] = useState("");

  const derived = useMemo(() => deriveCharacter(game, draft), [game, draft]);
  const maxPips = game.rules.partyLevels.statPips.maxPerMainStat;
  const classLevelMax = game.rules.classProgression.classLevelMax;
  const backgroundTiers = game.rules.partyLevels.backgroundAbilityTiers;
  const existingClasses = useMemo(
    () => draft.classes.map((t) => t.class),
    [draft.classes],
  );

  const patch = (mutate: (d: CharacterV1) => void) =>
    setDraft((prev) => {
      const next = clone(prev);
      mutate(next);
      return next;
    });

  const save = () => {
    if (draft.name.trim() === "") {
      setError("Character name is required.");
      return;
    }
    try {
      props.store.save(draft);
      props.onSaved(draft.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  return (
    <>
      <section className="panel sheet-header">
        <div>
          <p className="eyebrow">Edit character</p>
          <h2>{draft.name}</h2>
          <p className="muted">Changes are local until you save.</p>
        </div>
        <div className="button-row">
          <button className="primary compact" onClick={save}>
            Save changes
          </button>
          <button className="secondary compact" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </section>

      {error && (
        <div className="notice danger-notice" role="alert">
          {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <h2>Derived preview</h2>
        </div>
        <div className="stat-grid">
          <article className="stat-card">
            <span className="stat-label">Max HP</span>
            <strong className="stat-value">{derived.maxHp}</strong>
            <span className="stat-detail">provisional rules</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Current HP</span>
            <strong className="stat-value">{draft.resources.currentHp}</strong>
            <span className="stat-detail">manual</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Party level</span>
            <strong className="stat-value">{draft.partyLevel}</strong>
            <span className="stat-detail">P.LVL</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Class levels</span>
            <strong className="stat-value">{draft.classes.length}</strong>
            <span className="stat-detail">tracks</span>
          </article>
        </div>
        <div className="stat-chip-grid preview-chips">
          {MAIN_STATS.map((stat) => (
            <div className="stat-chip" key={stat}>
              <span>{stat}</span>
              <strong>{derived.main[stat] ?? 0}</strong>
            </div>
          ))}
        </div>
        {derived.notes.length > 0 && (
          <ul className="note-list">
            {derived.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Identity</h2>
        </div>
        <div className="form">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => patch((d) => { d.name = e.target.value; })}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={4}
              value={draft.notes}
              onChange={(e) => patch((d) => { d.notes = e.target.value; })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Resources</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Current HP</span>
            <input
              type="number"
              value={draft.resources.currentHp}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) patch((d) => { d.resources.currentHp = value; });
              }}
            />
          </label>
          <label className="field">
            <span>Energy</span>
            <input
              type="number"
              value={draft.resources.energy}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) patch((d) => { d.resources.energy = value; });
              }}
            />
          </label>
          <label className="field">
            <span>Exhaustion</span>
            <input
              type="number"
              value={draft.resources.exhaustion}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) patch((d) => { d.resources.exhaustion = value; });
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Leveling</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Party level</span>
            <input
              type="number"
              min={0}
              value={draft.partyLevel}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 0)
                  patch((d) => { d.partyLevel = Math.min(255, value); });
              }}
            />
          </label>
          <label className="field">
            <span>Gold</span>
            <input
              type="number"
              min={0}
              value={draft.currency.gold}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 0)
                  patch((d) => { d.currency.gold = value; });
              }}
            />
          </label>
          <label className="field">
            <span>Shards</span>
            <input
              type="number"
              min={0}
              value={draft.currency.shards}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 0)
                  patch((d) => { d.currency.shards = value; });
              }}
            />
          </label>
        </div>

        <h3 className="section-title">Stat pips</h3>
        <p className="muted small">Maximum {maxPips} per main stat.</p>
        <div className="level-list">
          {MAIN_STATS.map((stat) => {
            const pips = draft.statPips[stat] ?? 0;
            return (
              <div className="level-row" key={stat}>
                <span>{stat}</span>
                <button
                  className="tiny"
                  disabled={pips === 0}
                  onClick={() =>
                    patch((d) => {
                      d.statPips[stat] = Math.max(0, (d.statPips[stat] ?? 0) - 1);
                    })
                  }
                >
                  −
                </button>
                <strong>{pips}</strong>
                <button
                  className="tiny"
                  disabled={pips >= maxPips}
                  onClick={() =>
                    patch((d) => {
                      d.statPips[stat] = Math.min(maxPips, (d.statPips[stat] ?? 0) + 1);
                    })
                  }
                >
                  +
                </button>
              </div>
            );
          })}
        </div>

        <h3 className="section-title">Class tracks</h3>
        <p className="muted small">
          Class level cap is {classLevelMax}. Unlocks are manual.
        </p>
        {draft.classes.map((track, trackIndex) => {
          const cls = game.class(track.class);
          const className = cls?.name ?? track.class;
          const isSub = track.role === "sub";
          return (
            <div className="track-card" key={track.class}>
              <div className="level-row">
                <span>{className}</span>
                <span className="pill">{track.role}</span>
                <button
                  className="tiny"
                  disabled={track.level === 0}
                  onClick={() =>
                    patch((d) => {
                      d.classes[trackIndex].level = Math.max(
                        0,
                        d.classes[trackIndex].level - 1,
                      );
                    })
                  }
                >
                  −
                </button>
                <strong>{track.level}</strong>
                <button
                  className="tiny"
                  disabled={track.level >= classLevelMax}
                  onClick={() =>
                    patch((d) => {
                      d.classes[trackIndex].level = Math.min(
                        classLevelMax,
                        d.classes[trackIndex].level + 1,
                      );
                    })
                  }
                >
                  +
                </button>
                <label className="inline-field">
                  <span>X</span>
                  <input
                    type="number"
                    min={1}
                    value={track.x}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!Number.isNaN(value))
                        patch((d) => {
                          d.classes[trackIndex].x = Math.max(1, value);
                        });
                    }}
                  />
                </label>
                {isSub && (
                  <button
                    className="danger tiny"
                    onClick={() =>
                      patch((d) => {
                        d.classes.splice(trackIndex, 1);
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              {cls && (
                <details className="unlock-details">
                  <summary>Actions and passives</summary>
                  <div className="checkbox-grid">
                    {cls.actions.map((action) => {
                      const checked = track.unlockedActions.includes(action.name);
                      return (
                        <label className="check-row" key={action.name}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              patch((d) => {
                                toggleNamed(
                                  d.classes[trackIndex].unlockedActions,
                                  action.name,
                                );
                              })
                            }
                          />
                          <span>{action.name}</span>
                        </label>
                      );
                    })}
                    {cls.passives.map((passive) => {
                      const checked = track.unlockedPassives.includes(passive.name);
                      return (
                        <label className="check-row" key={passive.name}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              patch((d) => {
                                toggleNamed(
                                  d.classes[trackIndex].unlockedPassives,
                                  passive.name,
                                );
                              })
                            }
                          />
                          <span>{passive.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          );
        })}

        <div className="form-grid add-row">
          <label className="field">
            <span>Add class track</span>
            <select value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
              {game.classes
                .filter((cls) => !existingClasses.includes(cls.id))
                .map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              if (newClassId === "") return;
              if (existingClasses.includes(newClassId)) return;
              patch((d) => {
                d.classes.push({
                  class: newClassId,
                  role: "sub",
                  level: 1,
                  x: 1,
                  unlockedActions: [],
                  unlockedPassives: [],
                });
              });
            }}
          >
            Add subclass
          </button>
        </div>

        <h3 className="section-title">Background abilities</h3>
        {draft.backgrounds.length === 0 ? (
          <p className="muted small">No background selected.</p>
        ) : (
          draft.backgrounds.map((selection, backgroundIndex) => {
            const background = game.background(selection.background);
            if (!background) return null;
            return (
              <div className="track-card" key={selection.background}>
                <div className="level-row">
                  <strong>{background.name}</strong>
                  <span className="pill">background</span>
                </div>
                {backgroundTiers.map((tier) => {
                  const unlocked = draft.partyLevel >= tier;
                  const current =
                    selection.chosenAbilities.find((c) => c.partyLevel === tier)?.ability ?? "";
                  return (
                    <div className="level-row" key={tier}>
                      <span>P.LVL {tier}</span>
                      {unlocked ? (
                        <select
                          value={current}
                          onChange={(e) =>
                            patch((d) => {
                              const sel = d.backgrounds[backgroundIndex];
                              sel.chosenAbilities = sel.chosenAbilities.filter(
                                (c) => c.partyLevel !== tier,
                              );
                              if (e.target.value !== "") {
                                sel.chosenAbilities.push({
                                  partyLevel: tier,
                                  ability: e.target.value,
                                });
                              }
                            })
                          }
                        >
                          <option value="">—</option>
                          {background.passives
                            .filter((passive) =>
                              passive.requirements.some(
                                (r) => r.kind === "party-level" && r.level === tier,
                              ),
                            )
                            .map((passive) => (
                              <option key={passive.name} value={passive.name}>
                                {passive.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span className="muted small">locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Statuses</h2>
        </div>
        <div className="level-list">
          {draft.statuses.map((status, index) => (
            <div className="level-row" key={index}>
              <span>{status.name}</span>
              <span className="pill">{status.kind}</span>
              <button
                className="danger tiny"
                onClick={() =>
                  patch((d) => {
                    d.statuses.splice(index, 1);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid add-row">
          <label className="field">
            <span>New status</span>
            <input
              type="text"
              placeholder="e.g. Inspired"
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Kind</span>
            <select
              value={newStatusKind}
              onChange={(e) => setNewStatusKind(e.target.value as StatusKind)}
            >
              {STATUS_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              const nameValue = newStatusName.trim();
              if (nameValue === "") {
                setError("Status name is required.");
                return;
              }
              patch((d) => {
                d.statuses.push({
                  id: slugify(nameValue, "status"),
                  name: nameValue,
                  kind: newStatusKind,
                  note: "",
                });
              });
              setNewStatusName("");
            }}
          >
            Add status
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Equipment</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Main hand</span>
            <select
              value={draft.equipment.mainHand ?? ""}
              onChange={(e) =>
                patch((d) => {
                  d.equipment.mainHand = optional(e.target.value);
                })
              }
            >
              <option value="">—</option>
              {game.items
                .filter((item) => item.slot === "main-hand")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Armor</span>
            <select
              value={draft.equipment.armor ?? ""}
              onChange={(e) =>
                patch((d) => {
                  d.equipment.armor = optional(e.target.value);
                })
              }
            >
              <option value="">—</option>
              {game.items
                .filter((item) => item.slot === "armor")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Off hand</span>
            <select
              value={draft.equipment.offHand ?? ""}
              onChange={(e) =>
                patch((d) => {
                  d.equipment.offHand = optional(e.target.value);
                })
              }
            >
              <option value="">—</option>
              {game.items
                .filter((item) => item.slot === "off-hand")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="level-list">
          {draft.equipment.accessories.map((accessory, index) => (
            <div className="level-row" key={index}>
              <span>{itemName(game, accessory)}</span>
              <button
                className="danger tiny"
                onClick={() =>
                  patch((d) => {
                    d.equipment.accessories.splice(index, 1);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid add-row">
          <label className="field">
            <span>Add accessory</span>
            <select value={newAccessory} onChange={(e) => setNewAccessory(e.target.value)}>
              {game.items
                .filter((item) => item.slot === "accessory")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              if (newAccessory === "") return;
              patch((d) => {
                if (!d.equipment.accessories.includes(newAccessory)) {
                  d.equipment.accessories.push(newAccessory);
                }
              });
            }}
          >
            Add accessory
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Inventory</h2>
        </div>
        <div className="level-list">
          {draft.inventory.map((entry, index) => (
            <div className="inventory-row" key={index}>
              <span>{inventoryDisplayName(game, entry)}</span>
              <input
                type="number"
                min={1}
                value={entry.quantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!Number.isNaN(value))
                    patch((d) => {
                      d.inventory[index].quantity = Math.max(1, value);
                    });
                }}
              />
              <button
                className="danger tiny"
                onClick={() =>
                  patch((d) => {
                    d.inventory.splice(index, 1);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid add-row">
          <label className="field">
            <span>Item</span>
            <select value={newItemId} onChange={(e) => setNewItemId(e.target.value)}>
              {game.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Qty</span>
            <input
              type="number"
              min={1}
              value={newItemQty}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) setNewItemQty(Math.max(1, value));
              }}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              if (newItemId === "") return;
              const quantity = Math.max(1, newItemQty);
              patch((d) => {
                const existing = d.inventory.find((entry) => entry.item === newItemId);
                if (existing) {
                  existing.quantity += quantity;
                } else {
                  d.inventory.push({ item: newItemId, quantity, customName: null });
                }
              });
            }}
          >
            Add item
          </button>
        </div>
        <div className="form-grid add-row">
          <label className="field">
            <span>Custom item</span>
            <input
              type="text"
              placeholder="Item name"
              value={newCustomItem}
              onChange={(e) => setNewCustomItem(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Qty</span>
            <input
              type="number"
              min={1}
              value={newCustomQty}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) setNewCustomQty(Math.max(1, value));
              }}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              const nameValue = newCustomItem.trim();
              if (nameValue === "") return;
              patch((d) => {
                d.inventory.push({
                  item: null,
                  quantity: Math.max(1, newCustomQty),
                  customName: nameValue,
                });
              });
              setNewCustomItem("");
            }}
          >
            Add custom
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Slotted passives</h2>
        </div>
        <p className="muted small">
          Names only in this slice; the slot counts come from party-level rules.
        </p>
        <div className="form-grid">
          <label className="field">
            <span>Non-combat</span>
            <input
              type="text"
              placeholder="Passive name"
              value={newNonCombat}
              onChange={(e) => setNewNonCombat(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              const nameValue = newNonCombat.trim();
              if (nameValue === "") return;
              patch((d) => {
                d.passiveSlots.nonCombat.push(nameValue);
              });
              setNewNonCombat("");
            }}
          >
            Add
          </button>
        </div>
        <div className="level-list">
          {draft.passiveSlots.nonCombat.map((passive, index) => (
            <div className="level-row" key={index}>
              <span>{passive}</span>
              <button
                className="danger tiny"
                onClick={() =>
                  patch((d) => {
                    d.passiveSlots.nonCombat.splice(index, 1);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="form-grid add-row">
          <label className="field">
            <span>Combat</span>
            <input
              type="text"
              placeholder="Passive name"
              value={newCombat}
              onChange={(e) => setNewCombat(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              const nameValue = newCombat.trim();
              if (nameValue === "") return;
              patch((d) => {
                d.passiveSlots.combat.push(nameValue);
              });
              setNewCombat("");
            }}
          >
            Add
          </button>
        </div>
        <div className="level-list">
          {draft.passiveSlots.combat.map((passive, index) => (
            <div className="level-row" key={index}>
              <span>{passive}</span>
              <button
                className="danger tiny"
                onClick={() =>
                  patch((d) => {
                    d.passiveSlots.combat.splice(index, 1);
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="button-row save-bar">
        <button className="primary" onClick={save}>
          Save changes
        </button>
        <button className="secondary" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}

function toggleNamed(values: string[], name: string): void {
  const index = values.indexOf(name);
  if (index >= 0) values.splice(index, 1);
  else values.push(name);
}

function optional(value: string): string | null {
  return value === "" ? null : value;
}

function itemName(game: GameData, id: string): string {
  return game.item(id)?.name ?? id;
}

function inventoryDisplayName(game: GameData, entry: InventoryEntry): string {
  if (entry.item) return game.item(entry.item)?.name ?? entry.customName ?? "Unknown item";
  return entry.customName ?? "Unknown item";
}
