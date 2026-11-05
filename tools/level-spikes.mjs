// The standard party at each level against on-level foes (powerFoes: a level+2 boss, four level−2 foes), score as the danger scale.
const L = Number(process.argv[2]);
const { simulate } = await import("/home/user/build/pf2e-combat-simulator/src/engine/fight.js");
const { DANGER_OPTIONS, DEATH_WEIGHT } = await import("/home/user/build/pf2e-combat-simulator/src/engine/danger-scale.js");
const { powerFoes } = await import("/home/user/build/pf2e-combat-simulator/src/engine/spell-power.js");
const { partyFor } = await import("/home/user/build/pf2e-combat-simulator/tools/lib/deadliness.mjs");
const { GRID } = await import("/home/user/build/pf2e-combat-simulator/tools/lib/feat-power.mjs");
const party = partyFor(L);
const hp = party.reduce((s, c) => s + c.hp.max, 0);
const out = { level: L };
for (const kind of ["boss", "group"]) {
  const foes = powerFoes(kind, L);
  let sum = 0, wins = 0, downs = 0; const N = 100;
  for (let seed = 0; seed < N; seed++) {
    const r = simulate({ combatants: [...party, ...foes] }, GRID ? { ...DANGER_OPTIONS, grid: GRID } : DANGER_OPTIONS, seed);
    const d = ((r.damageBy?.foes ?? 0) + (r.damageBy?.foesInduced ?? 0)) / hp;
    const dn = r.party.filter((c) => c.down).length, de = r.party.filter((c) => c.dead).length;
    sum += d + 0.25 * dn + DEATH_WEIGHT * de + (r.outcome === "defeat" ? 1 : 0); downs += dn; if (r.outcome !== "defeat") wins++;
  }
  out[kind] = { score: +(sum / N).toFixed(3), win: wins / N, downs: +(downs / N).toFixed(2) };
}
console.log(JSON.stringify(out));
