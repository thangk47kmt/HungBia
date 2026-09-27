import { isAdsClient } from "@/game/wallet";

type BreakInfo = { breakStatus?: string };

declare global {
  interface Window {
    adsbygoogle?: object[];
    adBreak?: (options: Record<string, unknown>) => void;
    adConfig?: (options: Record<string, unknown>) => void;
  }
}

let loadedClient = "";

export function prepareAds(client: string) {
  const id = client.trim();
  if (!isAdsClient(id) || loadedClient === id || typeof document === "undefined") return;
  loadedClient = id;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = (options) => {
    window.adsbygoogle?.push(options);
  };
  const previous = document.querySelector("script[data-hung-ads]");
  previous?.remove();
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(id)}`;
  script.crossOrigin = "anonymous";
  script.dataset.hungAds = "1";
  script.dataset.adFrequencyHint = "120s";
  document.head.appendChild(script);
  window.adConfig({ preloadAdBreaks: "on", sound: "on" });
}

export function showRewardedAd(client: string, name: string): Promise<"viewed" | "skipped" | "empty"> {
  if (!isAdsClient(client)) return Promise.resolve("empty");
  prepareAds(client);
  if (typeof window.adBreak !== "function") return Promise.resolve("empty");
  return new Promise((resolve) => {
    let settled = false;
    let started = false;
    const finish = (result: "viewed" | "skipped" | "empty") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => {
      if (!started) finish("empty");
    }, 15000);
    try {
      window.adBreak?.({
        type: "reward",
        name,
        beforeReward: (showAd: () => void) => {
          started = true;
          showAd();
        },
        adViewed: () => finish("viewed"),
        adDismissed: () => finish("skipped"),
        adBreakDone: (info: BreakInfo) => {
          if (info.breakStatus === "viewed") finish("viewed");
          else if (info.breakStatus === "dismissed") finish("skipped");
          else finish("empty");
        },
      });
    } catch {
      finish("empty");
    }
  });
}
