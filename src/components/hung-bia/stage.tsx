import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Heart, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { BeerDef, LevelDef } from "@/game/catalog";
import { BAR_BG, LEVELS } from "@/game/catalog";
import { setMuted, sfx, unlockAudio } from "@/game/audio";
import { Button } from "@/components/ui/button";
import { PaySheet } from "@/components/hung-bia/pay-sheet";
import { drawFrame } from "@/game/draw";
import { createSim, resizeSim, revive, step, type Sim } from "@/game/sim";
import { vnd, type Shop } from "@/game/wallet";
import { cn } from "@/lib/cn";

const STEP = 1 / 60;
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"]);

type Hud = { score: number; lives: number; caught: number; combo: number; target: number };

export function Stage({
  level,
  beer,
  muted,
  shop,
  onToggleMute,
  onClear,
  onFail,
  onExit,
  onWatchAd,
}: {
  level: LevelDef;
  beer: BeerDef;
  muted: boolean;
  shop: Shop;
  onToggleMute: () => void;
  onClear: (score: number) => void;
  onFail: (score: number) => void;
  onExit: () => void;
  onWatchAd: () => Promise<"ok" | "skip" | "empty">;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef(0);
  const dragRef = useRef(false);
  const pausedRef = useRef(false);
  const onClearRef = useRef(onClear);
  const onFailRef = useRef(onFail);
  const perks = useRef({ ad: true, pay: true });
  const downRef = useRef(false);
  onClearRef.current = onClear;
  onFailRef.current = onFail;

  const [hud, setHud] = useState<Hud>({
    score: 0,
    lives: 3,
    caught: 0,
    combo: 0,
    target: Math.max(1, level.spawn - 2),
  });
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(true);
  const [down, setDown] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [adNote, setAdNote] = useState("");
  const [adBusy, setAdBusy] = useState(false);
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 3200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setPaused((p) => {
          pausedRef.current = !p;
          return !p;
        });
        return;
      }
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keysRef.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const clear = () => keysRef.current.clear();
    const onVis = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVis);
    window.__controlsTest = {
      setKeys(codes) {
        keysRef.current = new Set(codes);
      },
      getX: () => simRef.current?.bucketX ?? 0,
    };
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
      delete window.__controlsTest;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = new Image();
    let bgOk = false;
    bg.onload = () => {
      bgOk = true;
    };
    bg.src = BAR_BG;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let reported = false;
    const snap = { score: -1, lives: -1, caught: -1, combo: -1 };

    const syncHud = (sim: Sim) => {
      if (
        snap.score === sim.score &&
        snap.lives === sim.lives &&
        snap.caught === sim.caught &&
        snap.combo === sim.combo
      ) {
        return;
      }
      snap.score = sim.score;
      snap.lives = sim.lives;
      snap.caught = sim.caught;
      snap.combo = sim.combo;
      setHud({
        score: sim.score,
        lives: sim.lives,
        caught: sim.caught,
        combo: sim.combo,
        target: sim.target,
      });
      if (sim.caught > 0) setHint(false);
    };

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      if (!simRef.current) {
        simRef.current = createSim(w, h, level, beer);
        syncHud(simRef.current);
      } else if (simRef.current.w !== w || simRef.current.h !== h) {
        resizeSim(simRef.current, w, h);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    const readMove = () => {
      const keys = keysRef.current;
      let x = touchRef.current;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
      const pads = navigator.getGamepads?.();
      if (pads) {
        for (const pad of pads) {
          if (!pad) continue;
          const ax = pad.axes[0] ?? 0;
          const dz = 0.18;
          if (Math.abs(ax) > dz) {
            const sign = Math.sign(ax);
            x += sign * ((Math.abs(ax) - dz) / (1 - dz));
          }
          if (pad.buttons[14]?.pressed) x -= 1;
          if (pad.buttons[15]?.pressed) x += 1;
        }
      }
      return Math.max(-1, Math.min(1, x));
    };

    const frame = (now: number) => {
      const sim = simRef.current;
      if (!sim) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (pausedRef.current || document.hidden) {
        last = now;
        acc = 0;
        drawFrame(ctx, sim, bgOk ? bg : null, reduced);
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      let steps = 0;
      let finished: "clear" | "fail" | null = null;
      sim.moveX = dragRef.current ? 0 : readMove();
      while (acc >= STEP && steps < 5) {
        const ev = step(sim, STEP);
        for (const e of ev) {
          if (e.type === "catch") sfx.catch();
          else if (e.type === "miss") sfx.miss();
          else if (e.type === "clear") {
            sfx.clear();
            finished = "clear";
          } else if (e.type === "fail") {
            sfx.fail();
            finished = "fail";
          }
        }
        acc -= STEP;
        steps += 1;
      }
      drawFrame(ctx, sim, bgOk ? bg : null, reduced);
      syncHud(sim);
      if (finished === "clear" && !reported) {
        reported = true;
        onClearRef.current(sim.score);
      } else if (finished === "fail" && !reported && !downRef.current) {
        const offer = perks.current.ad || perks.current.pay;
        if (offer) {
          downRef.current = true;
          pausedRef.current = true;
          setDown(true);
          setPayOpen(false);
        } else {
          reported = true;
          onFailRef.current(sim.score);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      simRef.current = null;
    };
  }, [beer, level]);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    if (!sim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    sim.pointerX = ((e.clientX - rect.left) / rect.width) * sim.w;
  };

  const hold = (dir: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    unlockAudio();
    touchRef.current = dir;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const pct = Math.min(100, Math.round((hud.caught / Math.max(1, hud.target)) * 100));

  const grantLife = (kind: "ad" | "pay") => {
    const sim = simRef.current;
    if (!sim) return;
    if (kind === "ad") perks.current.ad = false;
    else perks.current.pay = false;
    revive(sim);
    downRef.current = false;
    pausedRef.current = false;
    setDown(false);
    setPayOpen(false);
    setAdNote("");
    setHud((h) => ({ ...h, lives: 1, combo: 0 }));
  };

  const watchLifeAd = async () => {
    if (adBusy || !perks.current.ad) return;
    setAdBusy(true);
    setAdNote("");
    const result = await onWatchAd();
    setAdBusy(false);
    if (!downRef.current) return;
    if (result === "ok") grantLife("ad");
    else if (result === "skip") setAdNote("Xem hết quảng cáo mới được thêm mạng.");
    else {
      setAdBlocked(true);
      setAdNote("Google chưa có quảng cáo lúc này. Có thể nạp tiền để thêm mạng.");
    }
  };

  return (
    <div className="flex min-h-dvh justify-center bg-bg">
      <div
        ref={wrapRef}
        className="relative h-dvh w-full max-w-md touch-none overflow-hidden select-none"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            unlockAudio();
            dragRef.current = true;
            point(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            point(e);
          }}
          onPointerUp={() => {
            dragRef.current = false;
            if (simRef.current) simRef.current.pointerX = null;
          }}
          onPointerCancel={() => {
            dragRef.current = false;
            if (simRef.current) simRef.current.pointerX = null;
          }}
        />

        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
          <div className="pointer-events-auto min-w-0">
            <p className="text-xs font-semibold tracking-widest text-primary">
              MÀN {level.id}/{LEVELS.length}
            </p>
            <h2 className="truncate font-serif text-2xl leading-tight">{level.name}</h2>
            <div className="mt-1 flex gap-1" aria-label={`${hud.lives} mạng`}>
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={cn("size-5", i < hud.lives ? "fill-danger text-danger" : "text-line")}
                />
              ))}
            </div>
          </div>
          <div className="pointer-events-auto text-right">
            <p className="font-serif text-3xl leading-none tabular-nums">{hud.score}</p>
            <p className="text-sm text-muted">
              {hud.combo > 1 ? `Combo ×${hud.combo}` : "Điểm màn"}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg"
                onClick={onToggleMute}
                aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
              >
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg"
                onClick={() => {
                  if (downRef.current) return;
                  setPaused((p) => {
                    pausedRef.current = !p;
                    return !p;
                  });
                }}
                aria-label="Tạm dừng"
              >
                <Pause className="size-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="pointer-events-none absolute inset-x-4 top-28 z-10">
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-center text-sm text-foam">
            Hứng {hud.caught}/{hud.target} · {level.spawn} chai
          </p>
        </div>

        {hint && !paused ? (
          <p className="pointer-events-none absolute inset-x-6 top-40 z-10 text-center text-sm text-foam">
            Kéo thùng, hoặc giữ nút trái phải. Phím A và D cũng được.
          </p>
        ) : null}

        <div className="absolute inset-x-3 bottom-4 z-10 flex items-center justify-between">
          <button
            type="button"
            className="grid size-14 place-items-center rounded-2xl border border-line bg-surface/90 text-fg"
            aria-label="Sang trái"
            onPointerDown={hold(-1)}
            onPointerUp={() => {
              touchRef.current = 0;
            }}
            onPointerCancel={() => {
              touchRef.current = 0;
            }}
          >
            <ArrowLeft className="size-7" />
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full px-4 text-sm text-foam"
            onClick={onExit}
          >
            Về quầy
          </button>
          <button
            type="button"
            className="grid size-14 place-items-center rounded-2xl border border-line bg-surface/90 text-fg"
            aria-label="Sang phải"
            onPointerDown={hold(1)}
            onPointerUp={() => {
              touchRef.current = 0;
            }}
            onPointerCancel={() => {
              touchRef.current = 0;
            }}
          >
            <ArrowRight className="size-7" />
          </button>
        </div>

        {paused && !down ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 p-6">
            <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-5 text-center">
              <h3 className="font-serif text-3xl">Tạm dừng</h3>
              <p className="mt-2 text-sm text-muted">Thùng đứng yên cho đến khi bạn chơi tiếp.</p>
              <button
                type="button"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-fg"
                onClick={() => {
                  pausedRef.current = false;
                  setPaused(false);
                }}
              >
                <Play className="size-5" />
                Tiếp tục
              </button>
            </div>
          </div>
        ) : null}

        {down && payOpen ? (
          <PaySheet
            title="Mua 1 mạng"
            detail="Chuyển đúng số tiền và đúng mã đơn. Máy tự cộng khi ngân hàng hoặc MoMo báo đã nhận."
            kind="life"
            onPaid={() => grantLife("pay")}
            onClose={() => setPayOpen(false)}
          />
        ) : null}

        {down && !payOpen ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-bg/85 p-5">
            <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold tracking-widest text-danger">HẾT 3 MẠNG</p>
              <h3 className="mt-1 font-serif text-3xl">Thêm một mạng</h3>
              <p className="mt-2 text-sm text-muted">
                {perks.current.ad
                  ? "Xem quảng cáo để chơi tiếp. Chỉ một lần trong màn này."
                  : `Đã dùng lượt quảng cáo. Có thể nạp ${vnd(shop.lifePrice)} để thêm đúng một mạng.`}
              </p>
              {adNote ? <p className="mt-2 text-sm text-primary">{adNote}</p> : null}
              {perks.current.ad ? (
                <Button size="lg" className="mt-4" disabled={adBusy} onClick={watchLifeAd}>
                  {adBusy ? "Đang mở quảng cáo" : "Xem quảng cáo · +1 mạng"}
                </Button>
              ) : null}
              {!perks.current.ad || adBlocked ? (
                <Button
                  size="lg"
                  tone={perks.current.ad ? "quiet" : "primary"}
                  className="mt-2"
                  onClick={() => setPayOpen(true)}
                >
                  Nạp {vnd(shop.lifePrice)} · +1 mạng
                </Button>
              ) : null}
              <Button
                tone="quiet"
                size="lg"
                className="mt-2"
                onClick={() => {
                  downRef.current = false;
                  onFailRef.current(simRef.current?.score ?? 0);
                }}
              >
                Chấp nhận thua
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
