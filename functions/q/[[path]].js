export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(context.request.url);
  url.pathname = '/q/';
  const assetResponse = await context.env.ASSETS.fetch(
    new Request(url.toString(), context.request)
  );

  const response = new Response(assetResponse.body, assetResponse);
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  response.headers.set('Vary', 'Accept-Encoding');

  return response;
}
