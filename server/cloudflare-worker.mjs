import {api} from './api.mjs';
import {accessIdentity} from './access.mjs';

const error = (message, status) => new Response(JSON.stringify({error: message}), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'},
});

export function createWorker(authenticate = accessIdentity) {
  return {async fetch(request, env) {
    let user;
    try { user = await authenticate(request, env); }
    catch { return error('Cloudflare Access 설정이 필요합니다.', 503); }
    if (!user) return error('Cloudflare Access에 로그인해 주세요.', 401);
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      // Never trust a client-supplied identity from the previous hosting platform.
      headers.set('oai-authenticated-user-id', user);
      return api(new Request(request, {headers}), env);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
    if (url.pathname === '/admin' || url.pathname === '/admin/') url.pathname = '/admin/index.html';
    else if (url.pathname === '/') url.pathname = '/index.html';
    const asset = await env.ASSETS.fetch(new Request(url, request));
    const response = new Response(asset.body, asset);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'same-origin');
    return response;
  }};
}

export default createWorker();
