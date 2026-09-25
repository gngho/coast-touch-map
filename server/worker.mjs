import {api} from './api.mjs';
import assets from 'virtual:assets';
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return api(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=['/admin','/admin/'].includes(url.pathname)?'/admin/index.html':url.pathname==='/'?'/index.html':url.pathname;
  const asset=assets[path];if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
