import {cpSync,rmSync,mkdirSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.dirname(fileURLToPath(import.meta.url)),output=path.resolve(root,'dist');
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Invalid output path');
rmSync(output,{recursive:true,force:true});mkdirSync(path.join(output,'server'),{recursive:true});mkdirSync(path.join(output,'.openai'),{recursive:true});
const assets={},types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())walk(file);else{const key='/'+path.relative(path.join(root,'public'),file).split(path.sep).join('/'),ext=path.extname(file),binary=['.png','.jpg','.ico'].includes(ext);assets[key]={type:types[ext]||'application/octet-stream',binary,body:readFileSync(file,binary?'base64':'utf8')};}}}
walk(path.join(root,'public'));
await build({entryPoints:[path.join(root,'server/worker.mjs')],outfile:path.join(output,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[{name:'assets',setup(b){b.onResolve({filter:/^virtual:assets$/},()=>({path:'assets',namespace:'inline'}));b.onLoad({filter:/.*/,namespace:'inline'},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}]});
cpSync(path.join(root,'.openai/hosting.json'),path.join(output,'.openai/hosting.json'));cpSync(path.join(root,'drizzle'),path.join(output,'.openai/drizzle'),{recursive:true});
console.log('Sites Worker build: dist/server/index.js (bundled UI and D1 migrations)');
