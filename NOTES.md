# Notes

- **Fine-grained components rejected (Oct 2026).** Considered extracting all
  class passives (~120) and actions (~281) into individual files under
  `config/passives/` + a new `config/actions/`, with class files reduced to id
  ref lists and class-specific verbiage generalized. Rejected after overlap
  analysis:
  - Class combat kits are entirely bespoke — 0 identical cross-class pairs out
    of 281 actions (even the 5 shared names — Enraged Swing, Sever Magic,
    Targeted Shot, Thrust, From the Aether — all differ), so extraction would
    create ~281 single-use files with zero reuse.
  - Real duplication is small and concentrated: ~5 identical background
    boilerplates (Guarded, Conniving, Underground, Linguistic, Iron
    Stomach/Lung), a few cross-domain same-function pairs (Kryss Fated ≈ Grim
    Knight Reborn; Sticky Fingers ancestry/class; Inspired-on-check shape;
    +1 permanent STAT passives).
  - Decision: ancestry / background / class remain the smallest pieces,
    matching the game's design. If duplication ever itches, extract only the
    tiny shared set as explicit shared refs — not a wholesale remodel.
- **Jeweler misprint (vision-verified p031).** The ability bar printed under
  Jeweler is Artist's bar; Jeweler tiers in `config/backgrounds/jeweler.yaml`
  are inferred by Craftsman analogy and marked as such in every `detail`.
- **Wanderer blurb replaced.** The book prints Farmer's text under Wanderer;
  `config/backgrounds/wanderer.yaml` carries a replacement drawn from its tier
  abilities, noted in-file. Farmer keeps the authentic text.
- **Shard Bearer removed** from the dataset (unique choose-your-own template,
  doesn't fit the normal shape). Docs still transcribe it — only data dropped.
