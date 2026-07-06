// Bridge to the native ML Kit barcode scanner in the Capacitor iOS shell
// (whatslocal-ios), used to read QR codes. iOS WKWebView's getUserMedia is
// unreliable, so inside the native app we hand off to the native camera scanner.
// The hosted web app doesn't import the plugin's JS package — we call it through
// the Capacitor bridge injected on `window.Capacitor`. On the web (no native
// shell) this reports unavailable and the caller falls back to the zxing camera.

interface Barcode {
  rawValue?: string;
  displayValue?: string;
}
interface BarcodeScannerPlugin {
  // Ready-to-use native scanning UI. `formats` restricts to QR codes only.
  scan: (opts?: { formats?: string[] }) => Promise<{ barcodes: Barcode[] }>;
}
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { BarcodeScanner?: BarcodeScannerPlugin };
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

// True only inside the native iOS shell with the BarcodeScanner plugin registered.
export function nativeScanAvailable(): boolean {
  const c = cap();
  return !!c?.isNativePlatform?.() && !!c?.Plugins?.BarcodeScanner;
}

// Present the native QR scanner and resolve the decoded value. Throws on
// cancel/error (or no code) so the caller can surface a message / fall back.
export async function scanNativeQr(): Promise<string> {
  const plugin = cap()?.Plugins?.BarcodeScanner;
  if (!plugin) throw new Error("Native scanner unavailable");
  const { barcodes } = await plugin.scan({ formats: ["QR_CODE"] });
  const value = (barcodes?.[0]?.rawValue ?? barcodes?.[0]?.displayValue ?? "").toString();
  if (!value) throw new Error("No QR code found");
  return value;
}
