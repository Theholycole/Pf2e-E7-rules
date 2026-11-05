// packs/_source/<pack>/*.json → packs/<pack> (LevelDB, as Foundry reads it). `node tools/build-packs.mjs`
import { ClassicLevel } from "classic-level";
import fs from "node:fs";
const root = new URL("../packs/", import.meta.url).pathname;
for (const name of fs.readdirSync(`${root}_source`)) {
    fs.rmSync(`${root}${name}`, { recursive: true, force: true });
    const db = new ClassicLevel(`${root}${name}`, { keyEncoding: "utf8", valueEncoding: "json" });
    await db.open();
    const batch = db.batch();
    let n = 0;
    for (const file of fs.readdirSync(`${root}_source/${name}`).filter((f) => f.endsWith(".json"))) {
        const doc = JSON.parse(fs.readFileSync(`${root}_source/${name}/${file}`, "utf8"));
        batch.put(doc._key, doc);
        n++;
    }
    await batch.write();
    await db.close();
    console.log(`${name}: ${n}`);
}
