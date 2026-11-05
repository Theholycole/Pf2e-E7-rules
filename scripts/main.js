// E7 rules: an "E7 Feats" tab in the PF2e compendium browser that lists every feat a capped character can buy, priced in XP, with a
// Buy with XP button on each row (like the equipment tab's Buy). The PF2e browser has no API for new tabs, so the tab is a subclass of
// its Feats tab added to the browser after it's built; if a system update changes the browser, the tab isn't added and a warning says so.
import { MODULE_ID, DEFAULT_PRICES, DEFAULT_STRONG, accessBand, cap, featPrice, xpLabel } from "./prices.js";

const TAB = "e7";

// The cap's recommendations: the standard party against on-level foes (a level+2 boss, or four level−2 foes) at every level in the
// combat simulator (lower damage taken = stronger), with the class ratings' spikes (how many of 25 classes are above their own average).
// Strongest: 5, 3, 13, 7, 17. Weakest: 8–10, 12, 14, 16.
const CAP_NOTES = {
    3: "★ strong spike (early)",
    5: "★ strongest spike: party and most classes at their best",
    7: "★ strong spike, the E7 default (just before the 8th–10th dip)",
    8: "▼ dip",
    9: "▼ dip",
    10: "▼ dip",
    12: "▼ dip",
    13: "★ strong spike (high level)",
    14: "▼ dip",
    16: "▼ dip",
    17: "★ strong spike (very high level)"
};
const CAP_CHOICES = Object.fromEntries(Array.from({ length: 19 }, (_, i) => i + 2).map((level) => [level, CAP_NOTES[level] ? `${level} — ${CAP_NOTES[level]}` : String(level)]));
const E7_PACK = `${MODULE_ID}.e7-feats`;
const sluggify = (name) => game.pf2e?.system?.sluggify?.(name) ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

Hooks.once("init", () => {
    const setting = (key, data) => game.settings.register(MODULE_ID, key, { scope: "world", config: true, ...data });
    setting("capLevel", {
        name: "Level cap",
        hint: "Characters can't level past this; XP past the cap is spent on feats. ★ marks the levels where the simulator found the party strongest against on-level foes (and most classes at their best); ▼ marks a dip, where foes catch up.",
        type: Number,
        choices: CAP_CHOICES,
        default: 7
    });
    setting("gmCanExceed", { name: "GM can level past the cap", hint: "Lets a GM raise a character's level past the cap (for NPC allies or tests).", type: Boolean, default: true });
    setting("requireCap", { name: "Only capped characters can spend XP", hint: "Characters below the cap level up with XP as normal.", type: Boolean, default: true });
    setting("prices", {
        name: "Feat prices (JSON)",
        hint: `Override any of: ${Object.keys(DEFAULT_PRICES).join(", ")}. E7 feats keep their own prices.`,
        type: String,
        default: ""
    });
    setting("strongList", { name: "Strong feats (surcharge)", hint: "Comma-separated feat slugs that pay the strong-feat surcharge.", type: String, default: DEFAULT_STRONG.join(",") });
});

Hooks.once("ready", () => {
    try {
        installTab();
    } catch (error) {
        console.error(`${MODULE_ID} | couldn't add the E7 Feats tab`, error);
        if (game.user.isGM) ui.notifications.warn("E7 Rules: couldn't add the E7 Feats tab to the compendium browser (has the PF2e system changed it?).");
    }
});

// --- The level cap: a character's level can't be raised past it ----------------------------------------------------------------

Hooks.on("preUpdateActor", (actor, changes) => {
    if (actor.type !== "character") return;
    const level = foundry.utils.getProperty(changes, "system.details.level.value");
    if (level == null || level <= cap() || level <= (actor.level ?? 0)) return;
    if (game.user.isGM && game.settings.get(MODULE_ID, "gmCanExceed")) return;
    foundry.utils.setProperty(changes, "system.details.level.value", Math.max(actor.level ?? 1, cap()));
    ui.notifications.warn(`${actor.name} is at the E7 level cap (${cap()}). Spend XP on feats in the compendium browser's E7 Feats tab instead.`);
});

// --- The tab -----------------------------------------------------------------------------------------------------------------

function installTab() {
    const browser = game.pf2e?.compendiumBrowser;
    if (!browser?.tabs?.feat) throw new Error("no compendium browser feat tab");
    const FeatTab = browser.tabs.feat.constructor;

    class E7FeatTab extends FeatTab {
        tabName = TAB;
        tabLabel = "E7 Feats";
        storeFields = ["name", "originalName", "img", "uuid", "level", "rarity", "options", "price", "priceInCopper"];

        prepareFilterData() {
            const data = super.prepareFilterData();
            data.checkboxes.e7 = { isExpanded: true, label: "E7", options: {}, optionPrefix: "e7", selected: [] };
            data.order.options.price = { label: "XP", type: "numeric" };
            return data;
        }

        async loadData() {
            await super.loadData();
            const e7 = new Map();
            const pack = game.packs.get(E7_PACK);
            if (pack) for (const entry of await pack.getIndex({ fields: [`flags.${MODULE_ID}`] })) e7.set(entry.uuid, entry.flags?.[MODULE_ID] ?? {});
            this.indexData = this.indexData.flatMap((entry) => {
                const category = [...entry.options].find((o) => o.startsWith("category:"))?.slice("category:".length);
                const own = e7.get(entry.uuid);
                const xp = own ? own.xp : featPrice({ category, level: entry.level, slug: sluggify(entry.name) });
                if (xp == null) return [];
                entry.options.add(own ? "e7:e7" : "e7:other");
                entry.price = xpLabel(xp);
                entry.priceInCopper = xp;
                return [entry];
            });
            this.filterData.checkboxes.e7.options = {
                e7: { label: "E7 feats", selected: false },
                other: { label: "Other feats", selected: false }
            };
        }
    }

    const tab = new E7FeatTab(browser);
    browser.tabs[TAB] = tab;
    browser.tabsArray.push(tab);
    browser.dataTabsList = [...browser.dataTabsList, TAB];
    if (browser.settings && !browser.settings[TAB]) browser.settings[TAB] = {};
    game.modules.get(MODULE_ID).api = { tab, buy, priceOf };
}

// Each row of the E7 tab gets a Buy with XP button. The rows are Svelte's, keyed by the feat, so a row keeps its feat while the list
// is re-sorted or filtered; a row is matched to its feat by its place in the tab's results when it first appears.
Hooks.on("renderCompendiumBrowser", (app) => {
    const root = app.element;
    if (!root || root.dataset.e7Observed) return;
    root.dataset.e7Observed = "1";
    const decorate = () => {
        if (app.activeTabName !== TAB) return;
        const list = root.querySelector("ul.result-list");
        if (!list) return;
        const results = app.tabs[TAB].results;
        [...list.children].forEach((li, index) => {
            if (li.querySelector(".e7-buy")) return;
            const entry = results[index];
            if (!entry) return;
            const button = document.createElement("a");
            button.className = "e7-buy";
            button.dataset.tooltip = `Buy with XP (${entry.priceInCopper} XP)`;
            button.innerHTML = '<i class="fa-solid fa-star"></i>';
            button.style.flex = "0 0 1.5em";
            button.style.textAlign = "center";
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                buy(entry.uuid);
            });
            li.append(button);
        });
    };
    new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
    decorate();
});

// --- Buying ------------------------------------------------------------------------------------------------------------------

// The buyer: a selected token's character, else the user's own character.
function buyer() {
    const selected = canvas?.tokens?.controlled?.map((t) => t.actor).filter((a) => a?.type === "character") ?? [];
    return selected[0] ?? (game.user.character?.type === "character" ? game.user.character : null);
}

// A feat's price and what's in the way of buying it, for this actor.
export function priceOf(item, actor) {
    const flags = item.flags?.[MODULE_ID] ?? null;
    const level = item.system.level?.value ?? 0;
    const slug = item.slug ?? sluggify(item.name);
    const xp = flags?.xp ?? featPrice({ category: item.system.category, level, slug });
    const problems = [];
    if (xp == null) return { xp, problems: ["this feat can't be bought with XP"] };
    if (!actor) return { xp, problems };
    const feats = actor.itemTypes.feat;
    const owns = (s) => feats.filter((f) => f.slug === s).length;
    const have = actor.system.details.xp.value;
    if (game.settings.get(MODULE_ID, "requireCap") && actor.level < cap()) problems.push(`${actor.name} is below the level cap (${cap()})`);
    if (have < xp) problems.push(`${actor.name} has ${have} XP, needs ${xp}`);
    const max = item.system.maxTakable ?? 1;
    if (owns(slug) >= max) problems.push(max === 1 ? `${actor.name} already has ${item.name}` : `${actor.name} already has ${item.name} ${max} times`);
    for (const required of flags?.requires ?? []) if (!owns(required)) problems.push(`needs ${required.replace(/-/g, " ")}`);
    // Access feats: Veteran Hero to 10th, Exceptional Hero to 15th, a Legendary Hero selection for each feat of 16th level or higher.
    const band = flags ? (flags.legendary ? "legendary" : null) : accessBand(level);
    if (band === "veteran" && !owns("veteran-hero")) problems.push("needs Veteran Hero");
    if (band === "exceptional" && !owns("exceptional-hero")) problems.push("needs Exceptional Hero");
    if (band === "legendary") {
        const used = feats.filter((f) => f.flags?.[MODULE_ID]?.legendary || (!f.flags?.[MODULE_ID] && (f.system.level?.value ?? 0) >= 16 && f.system.category === "class")).length;
        if (owns("legendary-hero") <= used) problems.push("needs an unused Legendary Hero selection");
    }
    return { xp, problems };
}

export async function buy(uuid) {
    const actor = buyer();
    if (!actor) return ui.notifications.warn("Select your character's token, or assign a character to your user, to buy feats with XP.");
    if (!actor.isOwner) return ui.notifications.warn(`You don't own ${actor.name}.`);
    const item = await fromUuid(uuid);
    if (!item) return ui.notifications.error("E7 Rules: couldn't find that feat.");
    const { xp, problems } = priceOf(item, actor);
    if (xp == null) return ui.notifications.warn(`${item.name} can't be bought with XP.`);
    const have = actor.system.details.xp.value;
    if (problems.length && !game.user.isGM) return ui.notifications.warn(`Can't buy ${item.name}: ${problems.join("; ")}.`);
    const warning = problems.length ? `<p><strong>As GM, you're overriding:</strong> ${problems.join("; ")}.</p>` : "";
    const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Buy with XP" },
        content: `<p>Spend <strong>${xp} XP</strong> on <strong>${item.name}</strong> for ${actor.name}?</p><p>${actor.name} has ${have} XP; ${Math.max(0, have - xp)} left after.</p>${warning}`
    });
    if (!ok) return;
    const source = item.toObject();
    source._stats = { ...(source._stats ?? {}), compendiumSource: uuid };
    await actor.update({ "system.details.xp.value": Math.max(0, have - xp) });
    await actor.createEmbeddedDocuments("Item", [source]);
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>${actor.name}</strong> spent <strong>${xp} XP</strong> on @UUID[${uuid}]{${item.name}}.</p><p>XP: ${have} → ${Math.max(0, have - xp)}</p>`
    });
    ui.notifications.info(`${actor.name} bought ${item.name} for ${xp} XP.`);
}
