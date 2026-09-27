import { useEffect, useRef, useState, type ReactNode } from "react";
import { Beer, ChevronLeft, RotateCcw, Upload, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaView } from "@/components/hung-bia/media-view";
import { DemoAd, PaySheet } from "@/components/hung-bia/pay-sheet";
import { PayAdmin } from "@/components/hung-bia/pay-admin";
import { Stage } from "@/components/hung-bia/stage";
import { prepareAds, showRewardedAd } from "@/game/ads";
import {
  canWatchTurnAd,
  defaultShop,
  defaultWallet,
  formatRemain,
  grantTurns,
  isAdsClient,
  loadShop,
  loadWallet,
  REGEN_MS,
  saveShop,
  saveWallet,
  spendTurn,
  tickWallet,
  TURN_CAP,
  vnd,
  type Shop,
  type Wallet,
} from "@/game/wallet";
import {
  BAR_BG,
  BEERS,
  LEVELS,
  STAFF,
  beerById,
  levelById,
  staffById,
  type LevelDef,
} from "@/game/catalog";
import { deleteImage, fileToStoredBlob, portraitKey, putImage, rewardKey } from "@/game/media";
import { setMuted, unlockAudio } from "@/game/audio";
import { loadPayPublic } from "@/game/pay-client";
import {
  defaultSave,
  displayName,
  loadSave,
  progressOf,
  writeSave,
  type Progress,
  type Save,
} from "@/game/save";
import { cn } from "@/lib/cn";

type Screen =
  | { name: "gate" }
  | { name: "lobby" }
  | { name: "play"; level: number }
  | { name: "reward"; level: number; gained: number; total: number; best: number }
  | { name: "fail"; level: number }
  | { name: "turns"; level: number }
  | { name: "done"; total: number }
  | { name: "admin" };

export function HungBiaApp() {
  const [save, setSave] = useState<Save>(defaultSave);
  const [screen, setScreen] = useState<Screen>({ name: "gate" });
  const [rev, setRev] = useState(0);
  const [wallet, setWallet] = useState<Wallet>(defaultWallet);
  const [shop, setShop] = useState<Shop>(defaultShop);
  const [now, setNow] = useState(() => Date.now());
  const [demoOn, setDemoOn] = useState(false);
  const saveRef = useRef(save);
  const readyRef = useRef(false);
  const walletRef = useRef(wallet);
  const shopRef = useRef(shop);
  const demoRef = useRef<(() => void) | null>(null);
  saveRef.current = save;
  walletRef.current = wallet;
  shopRef.current = shop;

  useEffect(() => {
    const loaded = loadSave();
    readyRef.current = true;
    setSave(loaded);
    setMuted(loaded.muted);
    const storedWallet = loadWallet();
    saveWallet(storedWallet);
    setWallet(storedWallet);
    const storedShop = loadShop();
    setShop(storedShop);
    if (isAdsClient(storedShop.adsClient)) prepareAds(storedShop.adsClient);
    if (loaded.adult && loaded.name.trim()) setScreen({ name: "lobby" });
    void loadPayPublic()
      .then((pub) => {
        setShop((current) => ({
          ...current,
          momoPhone: pub.momoPhone,
          momoName: pub.momoName,
          bank: pub.bankName || pub.bankCode,
          account: pub.account,
          holder: pub.holder,
          lifePrice: pub.lifePrice,
          turnPrice: pub.turnPrice,
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      setWallet((current) => {
        const next = tickWallet(current, time);
        if (next.turns === current.turns && next.regenAt === current.regenAt) return current;
        saveWallet(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const flush = () => {
      if (readyRef.current) writeSave(saveRef.current);
    };
    const onVis = () => {
      if (document.hidden) flush();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const commit = (next: Save) => {
    writeSave(next);
    setSave(next);
  };

  const bump = () => setRev((n) => n + 1);

  const putWallet = (next: Wallet) => {
    saveWallet(next);
    setWallet(next);
  };

  const startLevel = (level: number) => {
    unlockAudio();
    const spent = spendTurn(walletRef.current);
    if (!spent) {
      setScreen({ name: "turns", level });
      return;
    }
    putWallet(spent);
    setScreen({ name: "play", level });
  };

  const requestAd = (slot: string) => {
    const client = shopRef.current.adsClient;
    if (!isAdsClient(client)) {
      return new Promise<"ok" | "skip" | "empty">((resolve) => {
        demoRef.current = () => {
          demoRef.current = null;
          setDemoOn(false);
          resolve("ok");
        };
        setDemoOn(true);
      });
    }
    return showRewardedAd(client, slot).then((result) =>
      result === "viewed" ? "ok" : result === "skipped" ? "skip" : "empty",
    );
  };

  const demo = demoOn ? (
    <DemoAd
      onDone={() => {
        demoRef.current?.();
      }}
    />
  ) : null;

  if (screen.name === "play") {
    const level = levelById(screen.level);
    const beer = beerById(save.beerId);
    return (
      <>
        <Stage
          level={level}
          beer={beer}
          muted={save.muted}
          shop={shop}
          onToggleMute={() => commit({ ...save, muted: !save.muted })}
          onExit={() => setScreen({ name: "lobby" })}
          onWatchAd={() => requestAd("extra-life")}
          onClear={(gained) => {
          const staffId = save.staffId;
          const prev = progressOf(save, staffId);
          const best = Math.max(prev.bestByLevel[String(level.id)] ?? 0, gained);
          const nextProg: Progress = {
            nextLevel: Math.max(prev.nextLevel, level.id + 1),
            runScore: prev.runScore + gained,
            bestByLevel: { ...prev.bestByLevel, [String(level.id)]: best },
          };
          const nextSave = { ...save, byStaff: { ...save.byStaff, [staffId]: nextProg } };
          commit(nextSave);
          if (level.id >= LEVELS.length) setScreen({ name: "done", total: nextProg.runScore });
          else
            setScreen({
              name: "reward",
              level: level.id,
              gained,
              total: nextProg.runScore,
              best,
            });
        }}
          onFail={() => setScreen({ name: "fail", level: level.id })}
        />
        {demo}
      </>
    );
  }

  return (
    <>
    <Shell>
      {screen.name === "gate" ? (
        <Gate
          initialName={save.name}
          already={save.adult}
          onEnter={(name) => {
            unlockAudio();
            commit({ ...save, name, adult: true });
            setScreen({ name: "lobby" });
          }}
        />
      ) : null}
      {screen.name === "lobby" ? (
        <Lobby
          save={save}
          rev={rev}
          wallet={wallet}
          now={now}
          onChange={commit}
          onPlay={startLevel}
          onReset={() => {
            const prev = progressOf(save, save.staffId);
            commit({
              ...save,
              byStaff: {
                ...save.byStaff,
                [save.staffId]: { nextLevel: 1, runScore: 0, bestByLevel: prev.bestByLevel },
              },
            });
          }}
          onAdmin={() => setScreen({ name: "admin" })}
          onRename={() => setScreen({ name: "gate" })}
        />
      ) : null}
      {screen.name === "reward" ? (
        <Reward
          save={save}
          rev={rev}
          level={levelById(screen.level)}
          gained={screen.gained}
          total={screen.total}
          best={screen.best}
          onNext={() => startLevel(screen.level + 1)}
          onLobby={() => setScreen({ name: "lobby" })}
          onAdmin={() => setScreen({ name: "admin" })}
        />
      ) : null}
      {screen.name === "fail" ? (
        <Fail
          level={levelById(screen.level)}
          onRetry={() => startLevel(screen.level)}
          onLobby={() => setScreen({ name: "lobby" })}
        />
      ) : null}
      {screen.name === "done" ? (
        <Done
          save={save}
          rev={rev}
          total={screen.total}
          onAgain={() => {
            commit({
              ...save,
              byStaff: {
                ...save.byStaff,
                [save.staffId]: { nextLevel: 1, runScore: 0, bestByLevel: progressOf(save, save.staffId).bestByLevel },
              },
            });
            startLevel(1);
          }}
          onLobby={() => setScreen({ name: "lobby" })}
        />
      ) : null}
      {screen.name === "turns" ? (
        <Turns
          level={levelById(screen.level)}
          wallet={wallet}
          shop={shop}
          now={now}
          onPlay={() => startLevel(screen.level)}
          onWatch={async () => {
            if (!canWatchTurnAd(walletRef.current)) return "skip" as const;
            const result = await requestAd("extra-turn");
            if (result === "ok") {
              const next = grantTurns(walletRef.current, 1);
              putWallet({ ...next, adTurnAt: Date.now() });
            }
            return result;
          }}
          onPaid={() => putWallet(grantTurns(walletRef.current, 1))}
          onLobby={() => setScreen({ name: "lobby" })}
        />
      ) : null}
      {screen.name === "admin" ? (
        <Admin
          save={save}
          rev={rev}
          shop={shop}
          onBack={() => setScreen({ name: "lobby" })}
          onSave={commit}
          onShop={(next) => {
            saveShop(next);
            setShop(next);
            if (isAdsClient(next.adsClient)) prepareAds(next.adsClient);
          }}
          onBump={bump}
        />
      ) : null}
    </Shell>
    {demo}
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-dvh text-fg">
      <img src={BAR_BG} alt="" className="pointer-events-none fixed inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none fixed inset-0 bg-bg/80" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6">{children}</div>
    </main>
  );
}

function Gate({
  initialName,
  already,
  onEnter,
}: {
  initialName: string;
  already: boolean;
  onEnter: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [adult, setAdult] = useState(already);
  const ready = adult && name.trim().length > 0;
  return (
    <div className="flex flex-1 flex-col justify-end sm:justify-center">
      <p className="text-xs font-semibold tracking-widest text-primary">QUÁN ĐÊM</p>
      <h1 className="mt-2 font-serif text-5xl leading-tight">Hứng Bia</h1>
      <p className="mt-3 max-w-sm text-base text-muted">
        Lon và chai rơi từ trên xuống. Kéo thùng để hứng. Qua màn sẽ mở ảnh ca làm của nhân viên — bạn tự gắn ảnh sau.
      </p>
      <div className="mt-5 flex gap-3">
        {STAFF.map((staff) => (
          <img
            key={staff.id}
            src={staff.portrait}
            alt=""
            className="h-24 w-16 rounded-xl border border-line object-cover"
          />
        ))}
      </div>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onEnter(name.trim());
        }}
      >
        <label className="block text-sm text-muted" htmlFor="player-name">
          Tên của bạn
        </label>
        <input
          id="player-name"
          value={name}
          maxLength={24}
          autoComplete="nickname"
          placeholder="Ví dụ: An"
          onChange={(e) => setName(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-fg outline-none placeholder:text-muted focus:border-primary"
        />
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
          />
          <span>Tôi đủ 18 tuổi. Trò chơi có bia.</span>
        </label>
        <Button size="lg" type="submit" disabled={!ready}>
          Vào quán
        </Button>
      </form>
    </div>
  );
}

function Lobby({
  save,
  rev,
  wallet,
  now,
  onChange,
  onPlay,
  onReset,
  onAdmin,
  onRename,
}: {
  save: Save;
  rev: number;
  wallet: Wallet;
  now: number;
  onChange: (save: Save) => void;
  onPlay: (level: number) => void;
  onReset: () => void;
  onAdmin: () => void;
  onRename: () => void;
}) {
  const prog = progressOf(save, save.staffId);
  const finished = prog.nextLevel > LEVELS.length;
  const continueLevel = Math.min(Math.max(prog.nextLevel, 1), LEVELS.length);
  const staff = staffById(save.staffId);
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary">CA ĐÊM</p>
          <h1 className="font-serif text-4xl leading-tight">Chào {save.name}</h1>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg"
          aria-label={save.muted ? "Bật tiếng" : "Tắt tiếng"}
          onClick={() => onChange({ ...save, muted: !save.muted })}
        >
          {save.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>

      <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span className="block font-semibold text-fg">{wallet.turns} lượt chơi</span>
        <span className="text-muted">
          {wallet.turns > TURN_CAP
            ? `Có lượt đã mua. Lượt miễn phí không vượt quá ${TURN_CAP}.`
            : wallet.turns >= TURN_CAP
              ? "Đủ 5 lượt miễn phí. Chơi bớt thì 8 giờ sau được cộng 1."
              : `Cộng 1 lượt miễn phí sau ${formatRemain(wallet.regenAt - now)}.`}
        </span>
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-muted">Nhân viên trực</h2>
        <div className="mt-3 flex w-full min-w-0 gap-3 overflow-x-auto pb-2">
          {STAFF.map((person) => {
            const selected = person.id === save.staffId;
            const their = progressOf(save, person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onChange({ ...save, staffId: person.id })}
                className={cn(
                  "w-40 shrink-0 overflow-hidden rounded-2xl border text-left",
                  selected ? "border-primary bg-surface-2" : "border-line bg-surface",
                )}
              >
                <MediaView
                  storageKey={portraitKey(person.id)}
                  rev={rev}
                  fallback={person.portrait}
                  alt=""
                  className="h-44 w-full object-cover"
                />
                <div className="p-3">
                  <p className="font-semibold">{displayName(save, person.id, person.name)}</p>
                  <p className="text-sm text-muted">{person.role}</p>
                  <p className="mt-1 text-xs text-muted">
                    {their.nextLevel > LEVELS.length ? "Hết 6 màn" : `Tới màn ${their.nextLevel}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted">{staff.line}</p>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-muted">Loại bia rơi</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {BEERS.map((beer) => {
            const selected = beer.id === save.beerId;
            return (
              <button
                key={beer.id}
                type="button"
                onClick={() => onChange({ ...save, beerId: beer.id })}
                className={cn(
                  "flex min-h-20 items-center gap-3 rounded-2xl border px-3 py-3 text-left",
                  selected ? "border-primary bg-surface-2" : "border-line bg-surface",
                )}
              >
                <span
                  className={cn("block shrink-0 rounded-md", beer.kind === "bottle" ? "h-10 w-4" : "h-8 w-6")}
                  style={{ background: beer.body }}
                />
                <span>
                  <span className="block font-semibold">{beer.name}</span>
                  <span className="block text-sm text-muted">
                    {beer.blurb} · {beer.points}đ
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          {finished
            ? `${displayName(save, staff.id, staff.name)} đã hết ca. Kỷ lục vẫn giữ.`
            : prog.nextLevel === 1
              ? "Mỗi màn 3 mạng. Hết mạng được xem quảng cáo một lần, rồi có thể nạp thêm một mạng."
              : `Đã qua màn ${prog.nextLevel - 1}. Điểm ca: ${prog.runScore}.`}
        </p>
        <Button
          size="lg"
          className="mt-3"
          onClick={() => {
            if (finished) {
              onReset();
              onPlay(1);
            } else onPlay(continueLevel);
          }}
        >
          <Beer className="size-5" />
          {wallet.turns <= 0
            ? "Hết lượt"
            : finished
              ? "Chơi lại từ đầu"
              : prog.nextLevel === 1
                ? "Vào ca"
                : `Chơi tiếp · Màn ${continueLevel}`}
        </Button>
        {!finished && prog.nextLevel > 1 ? (
          <Button
            tone="quiet"
            size="lg"
            className="mt-2"
            onClick={() => {
              onReset();
              onPlay(1);
            }}
          >
            Chơi lại từ màn 1
          </Button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button type="button" className="min-h-11 text-muted" onClick={onRename}>
          Đổi tên
        </button>
        <button type="button" className="min-h-11 font-semibold text-primary" onClick={onAdmin}>
          Quản trị
        </button>
      </div>
    </div>
  );
}

function Reward({
  save,
  rev,
  level,
  gained,
  total,
  best,
  onNext,
  onLobby,
  onAdmin,
}: {
  save: Save;
  rev: number;
  level: LevelDef;
  gained: number;
  total: number;
  best: number;
  onNext: () => void;
  onLobby: () => void;
  onAdmin: () => void;
}) {
  const staff = staffById(save.staffId);
  const name = displayName(save, staff.id, staff.name);
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-semibold tracking-widest text-primary">THƯỞNG MÀN {level.id}</p>
      <h1 className="font-serif text-4xl leading-tight">{level.name}</h1>
      <p className="mt-2 text-muted">
        {name} — {level.caption}
      </p>
      <MediaView
        storageKey={rewardKey(staff.id, level.id)}
        rev={rev}
        fallback={level.image}
        alt={`${name} sau màn ${level.name}`}
        className="shot mt-4 rounded-2xl border border-line"
      />
      <p className="mt-4 text-lg">
        Điểm màn <span className="font-semibold tabular-nums">{gained}</span>
        <span className="text-muted"> · cả ca {total}</span>
        {best === gained ? <span className="text-primary"> · kỷ lục</span> : null}
      </p>
      <Button size="lg" className="mt-4" onClick={onNext}>
        Màn tiếp
      </Button>
      <Button tone="quiet" size="lg" className="mt-2" onClick={onLobby}>
        Về quầy
      </Button>
      <button type="button" className="mt-3 min-h-11 text-sm text-primary" onClick={onAdmin}>
        Đổi ảnh màn này
      </button>
    </div>
  );
}

function Fail({
  level,
  onRetry,
  onLobby,
}: {
  level: LevelDef;
  onRetry: () => void;
  onLobby: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <p className="text-xs font-semibold tracking-widest text-danger">HẾT MẠNG</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">Màn {level.name} chưa qua</h1>
      <p className="mt-3 text-muted">Hết mạng và không cộng thêm. Chơi lại màn này tốn 1 lượt.</p>
      <Button size="lg" className="mt-6" onClick={onRetry}>
        Chơi lại màn
      </Button>
      <Button tone="quiet" size="lg" className="mt-2" onClick={onLobby}>
        Về quầy
      </Button>
    </div>
  );
}

function Done({
  save,
  rev,
  total,
  onAgain,
  onLobby,
}: {
  save: Save;
  rev: number;
  total: number;
  onAgain: () => void;
  onLobby: () => void;
}) {
  const staff = staffById(save.staffId);
  const last = LEVELS[LEVELS.length - 1]!;
  const name = displayName(save, staff.id, staff.name);
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-semibold tracking-widest text-primary">HẾT CA</p>
      <h1 className="font-serif text-4xl leading-tight">{name} khoá quán</h1>
      <p className="mt-2 text-muted">Sáu màn, điểm ca {total}. Ảnh cuối là ảnh demo — đổi trong quản trị nếu muốn.</p>
      <MediaView
        storageKey={rewardKey(staff.id, last.id)}
        rev={rev}
        fallback={last.image}
        alt={`${name} hết ca`}
        className="shot mt-4 rounded-2xl border border-line"
      />
      <Button size="lg" className="mt-4" onClick={onAgain}>
        Chơi lại từ đầu
      </Button>
      <Button tone="quiet" size="lg" className="mt-2" onClick={onLobby}>
        Về quầy
      </Button>
    </div>
  );
}

function Turns({
  level,
  wallet,
  shop,
  now,
  onPlay,
  onWatch,
  onPaid,
  onLobby,
}: {
  level: LevelDef;
  wallet: Wallet;
  shop: Shop;
  now: number;
  onPlay: () => void;
  onWatch: () => Promise<"ok" | "skip" | "empty">;
  onPaid: () => void;
  onLobby: () => void;
}) {
  const [pay, setPay] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const adOk = canWatchTurnAd(wallet, now);
  const waitAd = Math.max(0, wallet.adTurnAt + REGEN_MS - now);

  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <p className="text-xs font-semibold tracking-widest text-primary">
        {wallet.turns > 0 ? "CÒN LƯỢT" : "HẾT LƯỢT"}
      </p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">
        {wallet.turns > 0 ? "Chơi được rồi" : "Muốn chơi tiếp"}
      </h1>
      <p className="mt-3 text-muted">
        Đang có {wallet.turns} lượt. Miễn phí tối đa {TURN_CAP}, cộng 1 sau mỗi 8 giờ
        {wallet.turns < TURN_CAP ? ` — còn ${formatRemain(wallet.regenAt - now)}` : ""}.
      </p>
      {note ? <p className="mt-3 text-sm text-primary">{note}</p> : null}
      {wallet.turns > 0 ? (
        <Button size="lg" className="mt-6" onClick={onPlay}>
          Chơi màn {level.name}
        </Button>
      ) : (
        <>
          <Button
            size="lg"
            className="mt-6"
            disabled={!adOk || busy}
            onClick={() => {
              setBusy(true);
              setNote("");
              void onWatch().then((result) => {
                setBusy(false);
                if (result === "skip") setNote("Xem hết quảng cáo mới được cộng lượt.");
                else if (result === "empty") setNote("Google chưa có quảng cáo lúc này.");
              });
            }}
          >
            {busy ? "Đang mở quảng cáo" : adOk ? "Xem quảng cáo · +1 lượt" : "Đã xem quảng cáo trong 8 giờ"}
          </Button>
          {!adOk && wallet.turns <= 0 ? (
            <p className="mt-2 text-sm text-muted">Xem lại sau {formatRemain(waitAd)}.</p>
          ) : null}
          <Button
            tone="quiet"
            size="lg"
            className="mt-2"
            onClick={() => setPay(true)}
          >
            Nạp {vnd(shop.turnPrice)} · +1 lượt
          </Button>
        </>
      )}
      <Button tone="quiet" size="lg" className="mt-2" onClick={onLobby}>
        Về quầy
      </Button>
      {pay ? (
        <PaySheet
          title="Mua 1 lượt"
          detail="Chuyển đúng số tiền và đúng mã đơn. Hết mã này thì đơn khác không được tính."
          kind="turn"
          onPaid={() => {
            setPay(false);
            onPaid();
          }}
          onClose={() => setPay(false)}
        />
      ) : null}
    </div>
  );
}

function ShopFields({ shop, onShop }: { shop: Shop; onShop: (shop: Shop) => void }) {
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">Quảng cáo Google</h2>
      <p className="text-sm text-muted">Mã ca-pub của AdSense for Games. Chưa có mã thì game phát quảng cáo demo.</p>
      <label className="block text-sm text-muted" htmlFor="ads-client">
        Mã Google AdSense
        <input
          id="ads-client"
          value={shop.adsClient}
          placeholder="ca-pub-0000000000000000"
          spellCheck={false}
          onChange={(e) => onShop({ ...shop, adsClient: e.target.value.trim() })}
          className="mt-1 h-12 w-full rounded-xl border border-line bg-bg px-4 text-fg outline-none focus:border-primary"
        />
      </label>
    </div>
  );
}

function Admin({
  save,
  rev,
  shop,
  onBack,
  onSave,
  onShop,
  onBump,
}: {
  save: Save;
  rev: number;
  shop: Shop;
  onBack: () => void;
  onSave: (save: Save) => void;
  onShop: (shop: Shop) => void;
  onBump: () => void;
}) {
  const [staffId, setStaffId] = useState(save.staffId);
  const staff = staffById(staffId);
  const [draft, setDraft] = useState(displayName(save, staffId, staff.name));

  useEffect(() => {
    const person = staffById(staffId);
    setDraft(displayName(save, staffId, person.name));
  }, [save, staffId]);

  return (
    <div className="flex flex-1 flex-col">
      <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted" onClick={onBack}>
        <ChevronLeft className="size-4" />
        Về quầy
      </button>
      <h1 className="font-serif text-4xl leading-tight">Quản trị</h1>
      <p className="mt-2 text-sm text-muted">
        Gắn tài khoản nhận tiền ở form dưới. Ảnh nhân viên vẫn lưu trên máy này.
      </p>
      <PayAdmin
        onSaved={(pub) =>
          onShop({
            ...shop,
            momoPhone: pub.momoPhone,
            momoName: pub.momoName,
            bank: pub.bankName || pub.bankCode,
            account: pub.account,
            holder: pub.holder,
            lifePrice: pub.lifePrice,
            turnPrice: pub.turnPrice,
          })
        }
      />
      <ShopFields shop={shop} onShop={onShop} />
      <h2 className="mt-8 text-sm font-semibold text-muted">Ảnh nhân viên</h2>
      <p className="mt-2 text-sm text-muted">Chưa tải thì đang dùng ảnh demo.</p>
      <div className="mt-4 flex gap-2">
        {STAFF.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setStaffId(person.id)}
            className={cn(
              "min-h-11 flex-1 rounded-xl border px-2 text-sm font-semibold",
              person.id === staffId ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg",
            )}
          >
            {displayName(save, person.id, person.name)}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm text-muted" htmlFor="staff-name">
        Tên hiển thị
      </label>
      <input
        id="staff-name"
        value={draft}
        maxLength={24}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave({ ...save, names: { ...save.names, [staffId]: draft.trim() } })}
        className="mt-2 h-12 w-full rounded-xl border border-line bg-surface px-4 text-fg outline-none focus:border-primary"
      />
      <Slot
        title="Chân dung"
        storageKey={portraitKey(staffId)}
        rev={rev}
        fallback={staff.portrait}
        alt={staff.name}
        onBump={onBump}
      />
      <div className="mt-2 grid grid-cols-2 gap-3">
        {LEVELS.map((level) => (
          <Slot
            key={level.id}
            title={`Màn ${level.id} · ${level.name}`}
            storageKey={rewardKey(staffId, level.id)}
            rev={rev}
            fallback={level.image}
            alt={level.name}
            onBump={onBump}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  title,
  storageKey,
  rev,
  fallback,
  alt,
  onBump,
}: {
  title: string;
  storageKey: string;
  rev: number;
  fallback: string;
  alt: string;
  onBump: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = `file-${storageKey}`;

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await putImage(storageKey, await fileToStoredBlob(file));
      onBump();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Không tải được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <figure className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
      <MediaView storageKey={storageKey} rev={rev} fallback={fallback} alt={alt} className="shot" />
      <figcaption className="space-y-2 p-3">
        <p className="text-sm font-semibold">{title}</p>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-2 text-sm font-semibold text-primary-fg"
          >
            <Upload className="size-4" />
            {busy ? "Đang lưu" : "Đổi"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*,video/mp4,video/webm"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void take(file);
            }}
          />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl border border-line text-fg"
            aria-label="Dùng ảnh demo"
            onClick={() => {
              void deleteImage(storageKey).then(onBump);
            }}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
