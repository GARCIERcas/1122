import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname} from 'node:path';
const assets = {};
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.ttf':'font/ttf'};
for (const filename of await readdir('public',{recursive:true})) {
  const mime = types[extname(filename)];
  if (mime) assets['/'+filename] = [mime,(await readFile('public/'+filename)).toString('base64')];
}
await mkdir('dist/server',{recursive:true});
const source = (await readFile('worker.mjs','utf8')).replace("import assets from './assets.mjs';",() => 'const assets = '+JSON.stringify(assets)+';');
await writeFile('dist/server/index.js',source);
