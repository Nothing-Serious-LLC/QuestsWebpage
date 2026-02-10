const ALLOWED_ORIGINS = [
  "https://invite.thequestsapp.com",
  "https://thequestsapp.com",
];

function buildCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  headers["Vary"] = "Origin";
  return headers;
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Type": "application/json",
  };
}

export async function onRequest(context) {
  const origin = context.request.headers.get("Origin");
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null;

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...buildCorsHeaders(corsOrigin), ...securityHeaders() },
    });
  }

  const response = await context.next();

  const newHeaders = new Headers(response.headers);
  const merged = { ...buildCorsHeaders(corsOrigin), ...securityHeaders() };
  for (const [k, v] of Object.entries(merged)) {
    newHeaders.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
