# Handbook pages — LLM guide and index

This directory holds a full PDF→Markdown transcription of *Shards of Memory – Player Handbook (9-1-26).pdf* plus page-image sets for vision work. Read this file before opening any page image.

Source of truth for content: `docs/player-handbook-notes.md` (authoritative
handbook transcription; chart on p047 wins on prereq conflicts). Page scans
live under `docs/handbook_scan/` (convert AVIF → PNG/JPG before reading; see
"Converting a page" below.

## Image source

`docs/handbook_scan/` holds the 111 AVIF masters (2550x3300, 53M total). AVIF does **not** attach to multimodal LLMs — convert a page before reading it.

Half-res (1275x1650) is proven legible for body, diagrams, and sidebars. Full-res almost never helps — vision pipelines downscale past ~1500px anyway.

## Converting a page (copy-paste)

```bash
# Lossless PNG (~1.3M) — use for sidebar/badge/small-white-on-blue text
nix-shell -p imagemagick --run "magick 'docs/handbook_scan/p030.avif' -resize 50% -quality 90 '/tmp/p030.png'"

# Smaller JPEG (~0.4M) — fine for body copy and cheap passes
nix-shell -p imagemagick --run "magick 'docs/handbook_scan/p030.avif' -resize 50% -quality 80 '/tmp/p030.jpg'"
```

Replace `p030` with any page (`p001`–`p111`, see index below). Output goes to `/tmp` so the repo stays clean. Then `Read` the PNG/JPG. No system install needed — `nix-shell` provisions ImageMagick ephemerally and the AVIFs are never modified.

## Page index (entity → pages → file)

Cover / front: Cover p001, Character Sheet guide p002–p003, Character Creation p004–p005, Ancestry walkthrough p005 → `front-matter.md`.

Ancestries (lore even page is filler; crunch odd page holds the stats) → `ancestries.md`: Children of Maulawi p006+p007, Egrhand p008+p009, Enatt p010+p011, Halthket p012+p013, Khanadur p014+p015, Kryss p016+p017, Lagos p018+p019, Litoora p020+p021, Nethander p022+p023, Orinotis p024+p025, Skrii p026+p027, Uhhranti p028+p029.

Backgrounds → `backgrounds.md`: intro rules + index p030 (see also `p030.gold.md`); Craftsman shared rules + Armorer/Blacksmith/Clothier/Jeweler p031; Apprentice Alchemist + Apprentice Mage p032; Artist + Athlete p033; Barbarian + Chef p034; Cleric + Courier p035; Escort + Farmer p036; Gambler + Guard p037; Huntsman + Investigator p038; Merchant + Military p039; Miner + Noble p040; Politician + Psychologist p041 (book prints Politician where the p030 index says Diplomat); Rogue + Sailor p042; Spy + Swindler p043; Treasure Hunter + Wanderer p044; pirate-blending appendix p045.

Classes → `classes.md`: what-a-class intro p046; tier chart p047 (authoritative over page text on conflicts); sheet guide p048–p049; roster crunch (odd pages): Chemist p051, Gladiator p053, Ranger p055, Scholar p057, Soldier p059, Trickster p061, Beast Tamer p063, Knight p065, Monk p067, Priest p069, Thief p071, Wizard p073, Battle Mage p075, Berserker p077, Chronomancer p079, Negotiator p081, Ninja p083, Samurai p085, Alchemist p087, Bard p089, Dragon Lancer p091, Grim Knight p093, Invoker p095, Paladin p097, Assassin p099, Elementalist p101, Fortune Teller p103, Judge p105, Necromancer p107, Rune Knight p109, Shard Bearer p111. Example sheets (even pages, vision-transcribed): Soldier p048, Chemist p050, Gladiator p052, Ranger p054, Scholar p056 (action boxes blank in source), Trickster p060, Beast Tamer p062, Knight p064, Monk p066, Priest p068, Thief p070, Wizard p072, Battle Mage p074, Berserker p076, Chronomancer p078, Negotiator p080, Ninja p082, Samurai p084, Alchemist p086, Bard p088, Dragon Lancer p090, Grim Knight p092, Invoker p094, Paladin p096, Assassin p098, Elementalist p100, Fortune Teller p102, Judge p104, Necromancer p106, Rune Knight p108, Shard Bearer p110 (blank template).

## Known source quirks (transcribed as printed, flagged in place)
Diplomat (p030 index) vs Politician (p041 entry); chart-vs-page prereq conflicts on Judge, Negotiator, Fortune Teller (chart wins); Farmer/Wanderer share a blurb; Jeweler's printed bar on p031 is Artist's bar (misprint; Jeweler tiers inferred by analogy); Chemist prose duplicated as filler on other class pages; Gladiator expertise header says Knight; Bard song name spelled Scenetics Shanty; Necromancer ultimate charge line repeats Fortune Teller's.

## Phone app designs (`docs/phone-app/`, from `Shard - Phone App Idea.pdf`)
Single tall vector sheet → `phone-app-full.avif` (5100x8946, 300 DPI) plus 8 AVIF crops (300 DPI, q80, 568K total): top phone row `character-menu`, `choose-character-menu`, `main-menu`, `create-character-menu` (each with its flow arrows; submenu box lives inside character-menu); full-height columns `character-sheet-col` (stats/equipment/items + margin annotations), `classes-col`, `expertise-col`, `abilities-col`. Same convert-then-read workflow as handbook pages.
