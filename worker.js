// あそびば — Worker本体
// /api/kv だけを自分で処理して、それ以外のリクエスト(index.htmlなど)は
// 全部そのまま静的ファイルとして配信する(env.ASSETSに任せる)。

const TTL_SECONDS = 60 * 60 * 24 * 14; // 2週間で自動的に消える

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/kv') {
      const key = url.searchParams.get('key');
      if (!key) return json({ error: 'missing key' }, 400);

      if (!env.ASOBIBA_KV) {
        return json({ error: 'KV not bound. wrangler.jsonc の kv_namespaces を確認してね' }, 500);
      }

      if (request.method === 'GET') {
        const value = await env.ASOBIBA_KV.get(key);
        return json({ value });
      }

      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return json({ error: 'invalid json body' }, 400);
        }
        if (typeof body.value !== 'string') {
          return json({ error: 'body.value must be a string' }, 400);
        }
        await env.ASOBIBA_KV.put(key, body.value, { expirationTtl: TTL_SECONDS });
        return json({ ok: true });
      }

      return new Response('Method not allowed', { status: 405 });
    }

    // /api/kv 以外は普通の静的ファイル配信
    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
