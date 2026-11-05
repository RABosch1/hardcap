// Loads the browser modules into an isolated Node context so the tests run
// the same code the page runs, with no build step and no DOM. Each module
// attaches itself to `window`; here `window` is the context's global object.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Everything except the three DOM layers (render.js, plan-ui.js, app.js), in page order.
const MODULES = [
  'src/data/universe.js',
  'src/data/sectors.js',
  'src/data/research-snapshot.js',
  'src/data/sample-portfolio.js',
  'src/state.js',
  'src/analytics.js',
  'src/engine.js',
  'src/risk.js',
  'src/live-data.js',
  'src/transcripts.js',
  'src/claude-client.js',
  'src/scorecard.js',
  'src/ic.js',
  'src/chat.js',
];

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

export function loadHardcap() {
  const ctx = vm.createContext({
    console,
    localStorage: memoryStorage(),
    setTimeout, clearTimeout,
    URLSearchParams, AbortController, TextDecoder,
  });
  ctx.window = ctx;
  for (const rel of MODULES) {
    vm.runInContext(readFileSync(join(root, rel), 'utf8'), ctx, { filename: rel });
  }
  return ctx;
}

// Copies a value out of the module context into plain test-realm objects,
// so deepStrictEqual compares values rather than realms.
export const plain = (x) => JSON.parse(JSON.stringify(x));

export function readFixture(name) {
  return readFileSync(join(root, 'test', 'fixtures', name), 'utf8');
}
