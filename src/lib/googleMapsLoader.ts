// Lightweight Google Maps JS API loader (no npm dep)
let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve((window as any).google);
  if (loadPromise) return loadPromise;
  if (!apiKey) return Promise.reject(new Error("missing api key"));

  loadPromise = new Promise((resolve, reject) => {
    // Inline bootstrap loader (official pattern)
    (function (g: any) {
      const h: any = {}, a = "The Google Maps JavaScript API";
      const c = "google", l = "importLibrary";
      const e = "__ib__", q = document, b: any = window;
      b[c] = b[c] || {};
      const d = b[c].maps = b[c].maps || {},
        r = new Set<string>(),
        u = new URLSearchParams(),
        f = () => {
          if (h[e]) return h[e];
          const s = q.createElement("script");
          u.set("libraries", [...r] + "");
          for (const k in g) u.set(k.replace(/[A-Z]/g, t => "_" + t.toLowerCase()), g[k]);
          u.set("callback", c + ".maps." + e);
          s.src = `https://maps.googleapis.com/maps/api/js?` + u;
          s.onerror = () => reject(new Error(a + " could not load."));
          d[e] = () => resolve((window as any).google);
          q.head.appendChild(s);
          h[e] = true;
        };
      d[l] ? console.warn(a + " only loads once. Ignoring:", g) :
        d[l] = (lib: string, ...args: any[]) =>
          r.add(lib) && f().then(() => d[l](lib, ...args));
    })({ key: apiKey, v: "weekly" });
  });
  return loadPromise;
}

export async function importMapsLibrary<T extends keyof google.maps.MapsLibrary | "marker" | "maps">(
  apiKey: string,
  name: T
): Promise<any> {
  await loadGoogleMaps(apiKey);
  return (window as any).google.maps.importLibrary(name);
}
