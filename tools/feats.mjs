// The E7 feats (Cole's "E6 Rules — Level 7 Cap" and "E7 XP Costs — Draft v2"), as PF2e feat items: `node tools/feats.mjs` writes
// packs/_source/e7-feats/<slug>.json. XP prices are flags["pf2e-e7-rules"].xp; a feat that takes a Legendary Hero selection of its own has
// flags["pf2e-e7-rules"].legendary = true. Repeatable feats have maxTakable.
import crypto from "node:crypto";
import fs from "node:fs";

const p = (text) => text.split("\n\n").map((para) => `<p>${para}</p>`).join("");
const FEATS = [
    { name: "Veteran Hero", xp: 250, text: "You can select class feats of up to 10th level for which you otherwise qualify." },
    { name: "Exceptional Hero", xp: 500, pre: ["Veteran Hero"], text: "You can select class feats of up to 15th level for which you otherwise qualify." },
    { name: "Legendary Hero", xp: 500, pre: ["Exceptional Hero"], max: 99, text: "This gives you access to <strong>one</strong> class feat of 16th level or higher, which you must buy separately. Select Legendary Hero again for each additional class feat of 16th level or higher. Master Spellcasting Advancement and Apex Spellcasting each use a Legendary Hero selection of their own.\n\n<strong>Special</strong> You can select this feat more than once." },
    { name: "Something of an Expert (Skill or Perception)", xp: 200, max: 99, text: "Choose one skill, or Perception, in which you are trained. Increase that proficiency rank to expert. This feat does not provide further advancement from expert to master or legendary.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different proficiency each time." },
    { name: "Something of an Expert (Saving Throw)", xp: 250, max: 3, text: "Choose one saving throw in which you are trained. Increase that proficiency rank to expert. This feat does not provide further advancement from expert to master or legendary.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different save each time." },
    { name: "Something of an Expert (Armor)", xp: 500, max: 4, text: "Choose one armor category in which you are trained. Increase that proficiency rank to expert. Requires GM approval.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different category each time." },
    { name: "Something of an Expert (Attacks or Class DC)", xp: 250, max: 4, text: "Choose one attack proficiency (a weapon category or unarmed attacks) or your class DC, in which you are trained. Increase that proficiency rank to expert. Requires GM approval." },
    { name: "Ability Training", xp: 250, max: 6, text: "Choose one attribute. You qualify for Ability Advancement with that attribute.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different attribute each time." },
    { name: "Ability Advancement (Key, Strength)", xp: 1000, pre: ["Ability Training (Strength)", "Strength is your key attribute"], text: "Increase your Strength modifier by 1." },
    { name: "Ability Advancement (Key, Martial)", xp: 750, pre: ["Ability Training for your key attribute", "your class attacks with Strikes"], text: "Increase your key attribute modifier by 1. Use Ability Advancement (Key, Strength) instead when your key attribute is Strength." },
    { name: "Ability Advancement (Key, Spellcaster)", xp: 300, pre: ["Ability Training for your key attribute", "your key attribute is your spellcasting attribute"], text: "Increase your key attribute modifier by 1." },
    { name: "Ability Advancement (Other)", xp: 250, max: 5, pre: ["Ability Training for the chosen attribute"], text: "Increase the chosen attribute modifier by 1. It can't be your key attribute.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different attribute each time." },
    { name: "Expanded Spell Knowledge", xp: 250, max: 99, text: "Learn spells with a combined rank-point cost of 3 (a cantrip costs 1/2). The spells must belong to a spell list available to you, can't be higher rank than you can normally cast, and can't be above 4th rank.\n\n<strong>Special</strong> You can select this feat multiple times." },
    { name: "Expanded Caster Stamina", xp: 250, max: 99, text: "Gain additional spell slots with combined ranks of 4, such as one 4th-rank slot, two 2nd-rank slots, or one 3rd-rank and one 1st-rank slot. This feat can't grant a slot above 4th rank.\n\n<strong>Special</strong> You can select this feat multiple times." },
    { name: "Expert Spellcasting Advancement", xp: 650, pre: ["Exceptional Hero", "the ability to cast 4th-rank spells from spell slots"], text: "Gain one 5th-rank and one 6th-rank spell slot for your primary spellcasting class. Your proficiency doesn't change. New spells of 5th rank and higher must be earned as rewards." },
    { name: "Master Spellcasting Advancement", xp: 450, legendary: true, pre: ["a Legendary Hero selection dedicated to this feat", "Expert Spellcasting Advancement"], text: "Retain your 5th- and 6th-rank slots and gain one 7th-rank and one 8th-rank spell slot for your primary spellcasting class. New spells of 5th rank and higher must be earned as rewards." },
    { name: "Master Spellcasting Proficiency", xp: 450, pre: ["Master Spellcasting Advancement"], text: "Your proficiency rank for spell attack modifiers and spell DCs increases to master." },
    { name: "Apex Spellcasting", xp: 400, legendary: true, pre: ["a separate Legendary Hero selection dedicated to this feat", "Master Spellcasting Advancement"], text: "Retain all slots from the previous advancements and gain one 9th-rank apex spell slot for your primary spellcasting class. You can learn only one 9th-rank spell, as a reward." },
    { name: "Veteran Class Feature", xp: 500, max: 99, pre: ["Veteran Hero", "your class grants the feature at 9th–11th level"], text: "You gain one class feature your class grants at 9th, 10th or 11th level, as if you were that level. It counts as that feature for prerequisites. A feature that only raises a proficiency needs GM approval.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different feature each time." },
    { name: "Legendary Training", xp: 400, max: 99, pre: ["Exceptional Hero", "master in the chosen skill"], text: "Your proficiency rank in one skill becomes legendary.\n\n<strong>Special</strong> You can select this feat more than once, choosing a different skill each time." },
    { name: "Improved Weapon Proficiency", xp: 700, pre: ["Exceptional Hero", "trained in the chosen weapon"], text: "Choose one weapon (such as longsword) or one unarmed attack you're trained in. Your proficiency rank with it increases by one step, to a maximum of master. If you're already master with it, it becomes legendary instead.\n\nThis raises your weapon specialization damage with it as normal for the new rank." }
];
const slugify = (s) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dir = new URL("../packs/_source/e7-feats/", import.meta.url).pathname;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
for (const f of FEATS) {
    const slug = slugify(f.name);
    const _id = crypto.createHash("sha1").update(`e7:${slug}`).digest("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
    const doc = {
        _id, _key: `!items!${_id}`, name: f.name, type: "feat", img: "icons/sundries/books/book-embossed-gold-red.webp",
        system: {
            slug, category: "general", level: { value: 7 }, actionType: { value: "passive" }, actions: { value: null },
            traits: { value: ["general"], rarity: "uncommon", otherTags: ["e7"] },
            prerequisites: { value: (f.pre ?? []).map((value) => ({ value })) },
            description: { value: `${p(f.text)}<p><strong>Cost</strong> ${f.xp} XP (E7)</p>`, gm: "" },
            publication: { title: "E7 Home Rules", authors: "", license: "OGL", remaster: true },
            maxTakable: f.max ?? 1, rules: []
        },
        flags: { "pf2e-e7-rules": { xp: f.xp, requires: (f.pre ?? []).filter((name) => FEATS.some((g) => g.name === name)).map(slugify), ...(f.legendary ? { legendary: true } : {}) } },
        ownership: { default: 0 }
    };
    fs.writeFileSync(`${dir}${slug}.json`, JSON.stringify(doc, null, 2) + "\n");
}
console.log(`${FEATS.length} feats → ${dir}`);
