// Lanternkeeper's entrypoint: Node 22, standard library only, nothing to install. The game itself
// is game/ — plain static files a desktop browser opens offline, no build step and no network
// request — and this program hands it in: it copies game/ and screenshots/ from this repository to
// the output directory and writes dossier.json there, the summary the judge reads, with the kit's
// own vendored library buildDossier, so the dossier is byte for byte what the scorer builds from
// the same files. Two runs write the same bytes: nothing here reads a clock or a random source.
//
// In the grader the output directory is /output; outside it, MAKEFUN_OUTPUT_DIR stands in:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (its gate.json). text_max_bytes shapes the dossier's text; the others
// refuse an entry the scorer would refuse anyway: more than four screenshots or one over 256 KiB,
// more than 993 entries or 48 MiB under game/, or a path under game/ longer than 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Every file under a directory, counted and summed: what the run says it handed in. */
function measure(dir) {
  let files = 0;
  let bytes = 0;
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return { files, bytes };
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

const game = measure(join(out, 'game'));
const shots = measure(join(out, 'screenshots'));
console.log(`Lanternkeeper handed in: game/ ${game.files} files (${game.bytes} bytes), screenshots/ ${shots.files} files, dossier.json ${dossier.byteLength} bytes.`);
