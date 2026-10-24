import { readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) results.push(...(await files(p)));
    else if (e.name !== "sw.js") results.push(p);
  }
  return results;
}
const paths = await files("dist");
const hash = createHash("sha256");
for (const p of paths) {
  hash.update(p);
  hash.update(await readFile(p));
}
const version = hash.digest("hex").slice(0, 12);
const urls = paths.map((p) => "./" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const PREFIX='brain-gym:'+self.registration.scope+':';const CACHE=PREFIX+'${version}';const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(e.request,{ignoreVary:true}))||fetch(e.request).catch(()=>e.request.mode==='navigate'?cache.match('./index.html',{ignoreVary:true}):Response.error())));});
`,
);
