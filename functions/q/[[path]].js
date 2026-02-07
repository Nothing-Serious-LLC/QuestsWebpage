export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/q/";
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}
