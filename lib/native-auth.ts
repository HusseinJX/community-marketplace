// Native (in-app) social sign-in.
//
// Inside the iOS Capacitor shell, Clerk's web popup/redirect OAuth fails: Google
// blocks OAuth in embedded webviews and WKWebView barely supports popups. The fix
// is to do the sign-in NATIVELY — a Capacitor plugin shows the real Apple / Google
// sheet, returns an identity token, and we hand that token straight to Clerk
// (which supports token sign-in: `authenticateWithGoogleOneTap` and the
// `oauth_token_apple` strategy — verified in @clerk/shared types). No backend
// exchange needed.
//
// These call `window.Capacitor.Plugins.{GoogleAuth,SignInWithApple}` — provided
// by the native shell (whatslocal-ios). Until those plugins are installed +
// synced + the app rebuilt, the plugin is absent and we throw a clear error;
// callers fall back to the web popup on non-native and surface the message here.

import type { useClerk } from "@clerk/nextjs";

type Clerkish = ReturnType<typeof useClerk>;
type SessionResult = { status?: string | null; createdSessionId?: string | null } | null | undefined;

// Resolve a native plugin's bridge proxy. Bare Swift-only plugins (no JS package)
// are NOT auto-populated on `Capacitor.Plugins` — the reliable way to reach them
// from the hosted web is `Capacitor.registerPlugin(name)`, which returns a proxy
// that routes calls to the native code. Fall back to the Plugins map just in case.
function plugin(name: string): Record<string, (...a: unknown[]) => Promise<unknown>> | undefined {
  if (typeof window === "undefined") return undefined;
  const c = (window as unknown as {
    Capacitor?: {
      registerPlugin?: (n: string) => unknown;
      Plugins?: Record<string, unknown>;
    };
  }).Capacitor;
  if (!c) return undefined;
  if (typeof c.registerPlugin === "function") {
    try {
      return c.registerPlugin(name) as never;
    } catch {
      /* fall through */
    }
  }
  return c.Plugins?.[name] as never;
}

async function activate(clerk: Clerkish, res: SessionResult): Promise<void> {
  const sid = res?.createdSessionId;
  if (sid) {
    await clerk.setActive({ session: sid });
    return;
  }
  if (res?.status !== "complete") throw new Error("Sign-in didn't complete.");
}

// Native Google: plugin returns an id token → Clerk's Google One Tap flow (which
// accepts a raw Google id token) creates/finds the account and a session.
export async function nativeGoogleSignIn(clerk: Clerkish): Promise<void> {
  const GoogleAuth = plugin("GoogleAuth");
  if (!GoogleAuth?.signIn) throw new Error("Google sign-in isn't available in this app build yet.");
  const result = (await GoogleAuth.signIn()) as { authentication?: { idToken?: string }; idToken?: string };
  const idToken = result?.authentication?.idToken ?? result?.idToken;
  if (!idToken) throw new Error("Google didn't return a sign-in token.");
  const res = await clerk.authenticateWithGoogleOneTap({ token: idToken });
  await activate(clerk, res);
}

// Native Apple: plugin returns the identity token → Clerk's `oauth_token_apple`.
// Try sign-in first (returning account); if there's no account yet, the same
// token creates one via sign-up.
export async function nativeAppleSignIn(clerk: Clerkish): Promise<void> {
  const SignInWithApple = plugin("SignInWithApple");
  if (!SignInWithApple?.authorize) throw new Error("Apple sign-in isn't available in this app build yet.");
  const result = (await SignInWithApple.authorize({ requestedScopes: ["email", "name"] })) as {
    response?: { identityToken?: string };
  };
  const token = result?.response?.identityToken;
  if (!token) throw new Error("Apple didn't return a sign-in token.");
  let res: SessionResult = await clerk.client.signIn.create({ strategy: "oauth_token_apple", token });
  if (res?.status !== "complete") {
    res = await clerk.client.signUp.create({ strategy: "oauth_token_apple", token, transfer: true });
  }
  await activate(clerk, res);
}
