// Simple Google Maps JS API loader using the official bootstrap snippet.
let bootstrapped = false;
let readyPromise: Promise<void> | null = null;

function bootstrap(apiKey: string) {
  if (bootstrapped) return;
  bootstrapped = true;
  // Official inline bootstrap (https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
  const g: any = { key: apiKey, v: "weekly" };
  const w: any = window;
  w.google = w.google || {};
  const d: any = (w.google.maps = w.google.maps || {});
  const r = new Set<string>();
  const u = new URLSearchParams();
  let scriptAdded = false;
  const loadScript = () =>
    new Promise<void>((resolve, reject) => {
      if (scriptAdded) return resolve();
      scriptAdded = true;
      const s = document.createElement("script");
      u.set("libraries", [...r].join(","));
      Object.keys(g).forEach((k) =>
        u.set(k.replace(/[A-Z]/g, (t) => "_" + t.toLowerCase()), g[k])
      );
      u.set("callback", "google.maps.__ib__");
      s.src = `https://maps.googleapis.com/maps/api/js?${u}`;
      s.async = true;
      s.onerror = () => reject(new Error("Google Maps failed to load"));
      d.__ib__ = () => resolve();
      document.head.appendChild(s);
    });
  d.importLibrary = (lib: string) => {
    r.add(lib);
    return loadScript().then(() =>
      (w.google.maps as any).importLibrary(lib)
    );
  };
}

export function ensureGoogleMaps(apiKey: string): Promise<void> {
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (readyPromise) return readyPromise;
  if (!apiKey) return Promise.reject(new Error("missing api key"));
  bootstrap(apiKey);
  readyPromise = (window as any).google.maps.importLibrary("maps").then(() => {});
  return readyPromise;
}

export async function importMapsLibrary(apiKey: string, name: string): Promise<any> {
  if (apiKey) bootstrap(apiKey);
  return (window as any).google.maps.importLibrary(name);
}
