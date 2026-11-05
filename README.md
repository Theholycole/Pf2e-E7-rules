# PF2e E7 Rules

Cole's E7 home rule for Pathfinder 2e: characters stop leveling at 7th level, and XP past the cap is spent like currency on feats.

- **E7 Feats compendium:** Veteran, Exceptional and Legendary Hero; Something of an Expert; Ability Training and Advancement; Expanded Spell Knowledge and Caster Stamina; the Expert, Master and Apex Spellcasting line; Veteran Class Feature; Legendary Training.
- **E7 Feats tab** in the compendium browser: every feat a capped character can buy, priced in XP. Filter to E7 feats, sort by XP, and buy with the ★ button.
- **Buy with XP** takes the XP from the selected character (or your assigned one), adds the feat, and posts a chat card. It checks the XP, the level cap, the access feats (Veteran Hero to 10th, Exceptional Hero to 15th, a Legendary Hero selection per 16th+ feat) and how many times a feat can be taken. A GM can override.

Prices follow *E7 XP Costs — Draft v2*. The GM can change them in the module settings (JSON) along with the strong-feat list.

Build the compendium before using a git checkout in Foundry: `npm install && npm run build` (packs/e7-feats is built, not tracked, so Foundry rewriting it never blocks a pull). Releases build it themselves.
