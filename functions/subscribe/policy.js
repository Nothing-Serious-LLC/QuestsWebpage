// Only these paired deployments can host checkout. Binding selects the backend.
const BACKENDS = {
  staging: 'https://dswtlvkjthzgpsgtfvwx.supabase.co',
  production: 'https://bltogjnxwvybhyfaivtw.supabase.co',
};
export function checkoutClaims(params) {
  return {
    version: Number(params.get('version')), uid: params.get('uid'),
    exp: Number(params.get('exp')), attempt: params.get('attempt'), plan: params.get('plan'),
    env: params.get('env'), appscheme: params.get('appscheme'), storefront: params.get('storefront'),
  };
}
export async function checkCheckout(env, claims, sig, action, outcome) {
  const backend = BACKENDS[env.PAYMENT_BACKEND_ENVIRONMENT];
  if (!backend || claims.env !== env.PAYMENT_BACKEND_ENVIRONMENT || claims.version !== 2) return false;
  try {
    const response = await fetch(`${backend}/functions/v1/sign-upgrade-link`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, claims, sig, outcome }),
      signal: AbortSignal.timeout(12000),
    });
    return response.ok;
  } catch { return false; }
}
