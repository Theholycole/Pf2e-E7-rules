// XP prices for feats under the E7 rules ("E7 XP Costs — Draft v2"). The GM can change every number in the module settings.
export const MODULE_ID = "pf2e-e7-rules";

export const DEFAULT_PRICES = {
    skill: 200,
    general: 300,
    ancestry: 300,
    classUpToCap: 500,
    veteran: 400, // class feats 8th–10th, with Veteran Hero
    exceptional: 500, // 12th–15th, with Exceptional Hero
    legendary: 750, // 16th+, with a Legendary Hero selection each
    strongSurcharge: 300,
    max: 1000
};

// Feats the simulator measured at half a level of power or more on a 7th-level party (Draft v2's strong list).
export const DEFAULT_STRONG = [
    "sky-master-mask",
    "coordinated-distraction",
    "haft-beatdown",
    "certain-strike",
    "nimble-strike",
    "rock-the-boat",
    "two-weapon-flurry",
    "brutal-finish",
    "quickened-casting",
    "twin-riposte"
];

export const cap = () => game.settings.get(MODULE_ID, "capLevel");
export const prices = () => ({ ...DEFAULT_PRICES, ...(safeJSON(game.settings.get(MODULE_ID, "prices")) ?? {}) });
export const strongList = () =>
    new Set(
        String(game.settings.get(MODULE_ID, "strongList"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
    );

function safeJSON(text) {
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

// The access band a feat of this level needs (null at or below the cap).
export function accessBand(level) {
    const c = cap();
    if (level <= c) return null;
    if (level <= 10) return "veteran";
    if (level <= 15) return "exceptional";
    return "legendary";
}

// The XP price of a feat that isn't an E7 feat: by category and level; null if it can't be bought with XP (class features, boons …).
export function featPrice({ category, level, slug }) {
    const p = prices();
    let base;
    if (category === "skill") base = p.skill;
    else if (category === "general") base = p.general;
    else if (category === "ancestry") base = p.ancestry;
    else if (category === "class") base = level <= cap() ? p.classUpToCap : p[accessBand(level)];
    else return null;
    // Skill, general and ancestry feats above the cap cost at least their band's price.
    if (category !== "class" && level > cap()) base = Math.max(base, p[accessBand(level)]);
    if (strongList().has(slug)) base += p.strongSurcharge;
    return Math.min(base, p.max);
}

// What the result list shows in its price column.
export function xpLabel(xp) {
    return { value: xp, toString: () => `${xp} XP` };
}
