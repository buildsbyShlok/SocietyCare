const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  css = fs.readFileSync(path.join(root, "src/styles/variables.css"), "utf8");
const parse = (s) =>
  Object.fromEntries(
    [...s.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
const [base, light] = css.split(':root[data-theme="light"]');
const themes = {
  dark: parse(base),
  light: { ...parse(base), ...parse(light) },
};
function color(t, k) {
  const v = t[k];
  assert.ok(v, "Missing " + k);
  return v.startsWith("var(") ? color(t, v.slice(4, -1)) : v;
}
function lum(hex) {
  let s = hex.replace("#", "");
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  const rgb = [0, 2, 4]
    .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ratio(a, b) {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
let count = 0,
  min = 100;
for (const [name, t] of Object.entries(themes)) {
  const pairs = [
    ["--color-gray-900", "--color-bg-base", 4.5],
    ["--color-gray-500", "--color-bg-base", 4.5],
    ["--color-gray-500", "--color-bg-surface", 4.5],
    ["--color-gray-500", "--color-bg-elevated", 4.5],
    ["--color-accent-highlight", "--color-accent-light", 4.5],
    ["--color-accent-highlight", "--color-bg-surface", 4.5],
    ["--color-on-accent", "--color-accent", 4.5],
    ["--color-on-accent", "--color-accent-dark", 4.5],
    ["--color-danger", "--color-danger-light", 4.5],
    ["--color-warning", "--color-warning-light", 4.5],
    ["--color-success", "--color-success-light", 4.5],
    ["--color-status-open", "--color-status-open-bg", 4.5],
    ["--color-control-border", "--color-bg-surface", 3],
    ["--color-control-border", "--color-bg-base", 3],
  ];
  for (const [a, b, threshold] of pairs) {
    const r = ratio(color(t, a), color(t, b));
    assert.ok(
      r >= threshold,
      name + " " + a + "/" + b + ": " + r.toFixed(2) + " < " + threshold,
    );
    count++;
    if (threshold === 4.5) min = Math.min(min, r);
  }
}
console.log(
  "PASS " +
    count +
    " semantic contrast pairs; lowest tested text ratio " +
    min.toFixed(2) +
    ":1",
);
for (const family of ["geist", "geist-mono", "inter"])
  for (const subset of ["latin", "latin-ext"]) {
    const file = path.join(
      root,
      "public/fonts",
      family + "-" + subset + ".woff2",
    );
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString(), "wOF2");
  }
assert.doesNotMatch(css, /fonts\.googleapis/);
console.log(
  "PASS six local WOFF2 assets; theme stylesheet has no third-party font import",
);
console.log(
  "Source checks do not certify rendered WCAG compliance or browser performance.",
);

const globalCss = fs.readFileSync(
  path.join(root, "src/styles/global.css"),
  "utf8",
);
const success = globalCss.match(/\.alert-success \{([\s\S]*?)\}/)[1];
const foreground = success.match(/(?:^|;)\s*color:\s*var\((--[\w-]+)\)/)[1];
const background = success.match(
  /background(?:-color)?:\s*var\((--[\w-]+)\)/,
)[1];
for (const [name, t] of Object.entries(themes))
  assert.ok(
    ratio(color(t, foreground), color(t, background)) >= 4.5,
    name + " success alert contrast",
  );
console.log("PASS actual success-alert contrast in both themes");
