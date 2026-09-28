// Renders every public repo as a star on a spiral: oldest in the centre, newest on the rim.
// Writes galaxy-light.svg and galaxy-dark.svg into the directory given as the first argument.
// Usage: node scripts/galaxy.mjs <out-dir>   (GITHUB_TOKEN is optional, raises the API rate limit)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const USER = "Forichok";
const EXTRA_REPOS = ["aqulasoft/DisYam"];
// Not on GitHub: the Android app and handwriter.ru.
const APPS = [{ name: "HandWriter", created: "2019-04", label: "1M+ installs" }];

const THEMES = {
  light: { sky: "#fbfcfe", star: "#1b2a4a", path: "#1b2a4a", halo: "#7aa7ff", warm: "#e8912d", fg: "#1f2328", mut: "#59636e" },
  dark: { sky: "#0a0f18", star: "#f4f7ff", path: "#c9d6ff", halo: "#58a6ff", warm: "#ffb45c", fg: "#e6edf3", mut: "#9198a1" },
};

const W = 720, H = 300, DRAW = 4.2;

async function gh(path) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "forichok-galaxy" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loadStars() {
  const own = await gh(`/users/${USER}/repos?per_page=100&type=owner`);
  const extra = await Promise.all(EXTRA_REPOS.map(r => gh(`/repos/${r}`)));
  const repos = [...own, ...extra].map(r => ({
    name: r.name, created: r.created_at.slice(0, 7), stars: r.stargazers_count, fork: r.fork,
  }));
  const apps = APPS.map(a => ({ ...a, app: true }));
  const all = [...repos, ...apps].sort((a, b) => a.created.localeCompare(b.created) || a.name.localeCompare(b.name));
  return { all, repoCount: repos.length };
}

// Seeded PRNG so the picture only changes when the data does.
function prng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const f = n => +n.toFixed(1);
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function render(stars, c) {
  const rnd = prng(20170630);
  const out = [];
  const dust = [];
  for (let i = 0; i < 90; i++) {
    const a = rnd(), b = rnd(), r = rnd();
    dust.push(`<circle class="s tw" cx="${f(8 + a * (W - 16))}" cy="${f(8 + b * (H - 16))}" r="${f(.5 + r * .5)}" fill-opacity=".3" style="animation-delay:${(.2 + a).toFixed(2)}s,${(r * 4).toFixed(2)}s"/>`);
  }

  const n = stars.length, CX = W / 2, CY = 150, TURNS = 2.15;
  const pts = stars.map((s, i) => {
    const k = i / (n - 1), th = -Math.PI / 2 + k * TURNS * 2 * Math.PI, rr = 10 + 118 * Math.pow(k, .9);
    const jx = (rnd() - .5) * 16, jy = (rnd() - .5) * 12;
    return { ...s, k, x: CX + Math.cos(th) * rr * 2.25 + jx, y: CY + Math.sin(th) * rr + jy };
  });
  const brightest = pts.filter(p => !p.app && !p.fork).reduce((a, b) => (b.stars > a.stars ? b : a));
  const newest = pts[n - 1];
  const at = k => (.3 + DRAW * k).toFixed(2);
  const label = (x, y, text, cls, delay) =>
    out.push(`<text class="lbl${cls ? " " + cls : ""}" x="${f(x)}" y="${f(y)}" style="animation-delay:${delay}s">${esc(text)}</text>`);

  pts.forEach((p, i) => {
    const d = at(p.k);
    if (p.app) {
      out.push(`<circle class="halo" cx="${f(p.x)}" cy="${f(p.y)}" r="54" fill="url(#gw)" style="animation-delay:${d}s;transform-origin:${f(p.x)}px ${f(p.y)}px"/>`);
      out.push(`<circle class="s" cx="${f(p.x)}" cy="${f(p.y)}" r="5" fill="${c.warm}" style="animation-delay:${d}s"/>`);
      label(p.x + 12, p.y - 22, p.name, "", (+d + .5).toFixed(2));
      label(p.x + 12, p.y - 9, p.label, "m", (+d + .7).toFixed(2));
      return;
    }
    if (p === brightest) {
      out.push(`<circle class="halo" cx="${f(p.x)}" cy="${f(p.y)}" r="46" fill="url(#g)" style="animation-delay:${d}s;transform-origin:${f(p.x)}px ${f(p.y)}px"/>`);
      out.push(`<circle class="s" cx="${f(p.x)}" cy="${f(p.y)}" r="4.6" style="animation-delay:${d}s"/>`);
      label(p.x + 12, p.y + 20, `${p.name} ★${p.stars}`, "", (+d + .5).toFixed(2));
      return;
    }
    const r = p.fork ? 2.4 : 1.6 + Math.log2(1 + p.stars) * .9;
    out.push(p.fork
      ? `<circle class="s fork" cx="${f(p.x)}" cy="${f(p.y)}" r="${r}" style="animation-delay:${d}s"/>`
      : `<circle class="s tw" cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r)}" style="animation-delay:${d}s,${(rnd() * 4).toFixed(2)}s"/>`);
    if (i === 0) label(p.x + 8, p.y - 8, `${p.created.slice(0, 4)} · hello, world`, "m", (+d + .3).toFixed(2));
    if (p === newest) {
      out.push(`<circle class="ring" cx="${f(p.x)}" cy="${f(p.y)}" r="5"/>`);
      label(p.x + 12, p.y + 4, `${p.name} · now`, "", (+d + .3).toFixed(2));
    }
  });

  const path = "M" + pts.map(p => `${f(p.x)} ${f(p.y)}`).join(" L");
  const stops = col => `<stop offset="0" stop-color="${col}" stop-opacity=".75"/><stop offset=".35" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${stars.length} stars: every repository of ${USER}, oldest in the centre">
<style>
.s{fill:${c.star};opacity:0;animation:appear .5s ease-out forwards}
.fork{fill:none;stroke:${c.star};stroke-width:1}
.tw{animation:appear .5s ease-out forwards,twinkle 4s ease-in-out infinite}
.path{fill:none;stroke:${c.path};stroke-opacity:.32;stroke-width:1;stroke-dasharray:6000;stroke-dashoffset:6000;animation:draw ${DRAW}s cubic-bezier(.5,0,.3,1) .3s forwards}
.halo{opacity:0;animation:nova 1.4s ease-out forwards}
.ring{fill:none;stroke:${c.halo};stroke-width:1.2;opacity:0;transform-box:fill-box;transform-origin:center;animation:ring 2.4s ease-out 4.6s infinite}
.lbl{font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${c.fg};paint-order:stroke;stroke:${c.sky};stroke-width:5px;stroke-linejoin:round;opacity:0;animation:appear .6s ease-out forwards}
.lbl.m{fill:${c.mut}}
.shoot{stroke:url(#sh);stroke-width:1.4;stroke-linecap:round;opacity:0;animation:shoot 11s linear 6s infinite}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes appear{to{opacity:1}}
@keyframes twinkle{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes nova{0%{opacity:0;transform:scale(.2)}60%{opacity:1;transform:scale(1.15)}100%{opacity:.85;transform:scale(1)}}
@keyframes ring{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}
@keyframes shoot{0%{opacity:0;transform:translate(0,0)}1%{opacity:1}6%{opacity:0;transform:translate(-220px,90px)}100%{opacity:0;transform:translate(-220px,90px)}}
@media (prefers-reduced-motion:reduce){*{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important}}
</style>
<defs>
<radialGradient id="g">${stops(c.halo)}</radialGradient>
<radialGradient id="gw">${stops(c.warm)}</radialGradient>
<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="${c.star}"/><stop offset="1" stop-color="${c.star}" stop-opacity="0"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" rx="14" fill="${c.sky}"/>
${dust.join("\n")}
<path class="path" d="${path}"/>
${out.join("\n")}
<line class="shoot" x1="640" y1="30" x2="700" y2="6"/>
</svg>
`;
}

const dir = process.argv[2] || ".";
mkdirSync(dir, { recursive: true });
const { all, repoCount } = await loadStars();
for (const [name, c] of Object.entries(THEMES)) writeFileSync(join(dir, `galaxy-${name}.svg`), render(all, c));
console.log(`${repoCount} repos + ${APPS.length} app → ${dir}/galaxy-{light,dark}.svg`);
