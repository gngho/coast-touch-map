import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {api} from './server/api.mjs';
import {localDatabase} from './server/dev-db.mjs';
fs.mkdirSync('.sites-runtime',{recursive:true});
const DB=localDatabase('.sites-runtime/coast.sqlite'),root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4173');
    if(url.pathname.startsWith('/api/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview-owner');
      const request=new Request(url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const response=await api(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const pathname=['/admin','/admin/'].includes(url.pathname)?'/admin/index.html':url.pathname==='/'?'/index.html':url.pathname;
    const file=path.resolve(root,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
  }catch(error){console.error(error);res.writeHead(500);res.end('Local server error');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173\nAdmin: http://127.0.0.1:4173/admin\nLocal-only test identity; production requires Sites sign-in.'));
