// Packt den Vite-Build (artifact/dist) in eine einzige HTML-Datei: artifact/dist/library.html
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("./dist/", import.meta.url).pathname;
const assets = join(dist, "assets");
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`Erwartet genau eine JS-Datei, gefunden: ${js.join(", ")}`);

const style = css.map((f) => readFileSync(join(assets, f), "utf8")).join("\n").replace(/<\/style/gi, "<\\/style");
const script = readFileSync(join(assets, js[0]), "utf8").replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const html = `<title>Library</title>
<style>${style}</style>
<div id="app"></div>
<script type="module">${script}</script>
`;
writeFileSync(join(dist, "library.html"), html);
console.log(`library.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
