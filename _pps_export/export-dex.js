// -----------------------------------------------------------------------------
// PPS — Showdown dex export for the battle bridge.
//
// Dumps species + move data for a given generation from Showdown's own Dex API
// to JSON the C# importer loads into the game DB.  Using Dex.mod('gen<N>')
// applies that gen's stat overrides and gen-filtered learnsets correctly.
//
// PokeOne's roster runs through #802 (marshadow) — a Gen 7 roster — so the
// default gen is 7, which covers the entire PokeOne PokemonID enum.
//
// Run from the fork root:   node _pps_export/export-dex.js [gen]   (default 7)
// Outputs:                  _pps_export/species_gen<gen>.json
//                           _pps_export/moves_gen<gen>.json
//
// NOT included: catch rate (Showdown is a battle sim and does not store it).
// Source separately (PokeAPI capture_rate / static table) for the catch mechanic.
// -----------------------------------------------------------------------------

const fs   = require('fs');
const path = require('path');
const { Dex } = require('../dist/sim');

const gen   = String(process.argv[2] || '7').replace(/\D/g, '') || '7';
const dex   = Dex.mod('gen' + gen);
const outDir = __dirname;

// Level-up source codes look like "<gen>L<level>", e.g. "7L16".
const levelRe = new RegExp('^' + gen + 'L(\\d+)$');

// ── Species + level-up learnsets ─────────────────────────────────────────────
const species = [];
for (const s of dex.species.all()) {
    if (s.isNonstandard) continue;          // skip species not legal in this gen
    if (!s.num || s.num < 1) continue;      // skip missingno / placeholders

    const learnset = [];
    const data = dex.species.getLearnsetData(s.id);
    if (data && data.learnset) {
        for (const [move, sources] of Object.entries(data.learnset)) {
            for (const src of sources) {
                const m = levelRe.exec(src);
                if (m) { learnset.push({ move, level: parseInt(m[1], 10) }); break; }
            }
        }
    }
    learnset.sort((a, b) => a.level - b.level);

    species.push({
        id:          s.id,
        num:         s.num,
        name:        s.name,
        baseStats:   s.baseStats,
        types:       s.types,
        abilities:   s.abilities,
        genderRatio: s.genderRatio,
        learnset,
    });
}
species.sort((a, b) => (a.num - b.num) || a.id.localeCompare(b.id));

// ── Moves ─────────────────────────────────────────────────────────────────────
const moves = [];
for (const mv of dex.moves.all()) {
    if (mv.isNonstandard) continue;
    if (!mv.exists) continue;
    moves.push({
        id:        mv.id,
        num:       mv.num,
        name:      mv.name,
        type:      mv.type,
        category:  mv.category,
        basePower: mv.basePower,
        accuracy:  mv.accuracy === true ? 0 : mv.accuracy,  // 0 = always hits
        pp:        mv.pp,
        target:    mv.target,
    });
}
moves.sort((a, b) => a.num - b.num);

fs.writeFileSync(path.join(outDir, `species_gen${gen}.json`), JSON.stringify(species, null, 1));
fs.writeFileSync(path.join(outDir, `moves_gen${gen}.json`),   JSON.stringify(moves, null, 1));

const lsTotal = species.reduce((n, s) => n + s.learnset.length, 0);
console.log(`gen${gen}: species_gen${gen}.json = ${species.length} species, ${lsTotal} level-up entries`);
console.log(`gen${gen}: moves_gen${gen}.json   = ${moves.length} moves`);
console.log('NOTE: catch rate not included (not in Showdown data).');
