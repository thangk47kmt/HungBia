export const TURN_CAP = 5;
export const REGEN_MS = 8 * 60 * 60 * 1000;

const WALLET_KEY = "hung-bia-wallet";
const SHOP_KEY = "hung-bia-shop";

export type Wallet = {
  turns: number;
  regenAt: number;
  adTurnAt: number;
};

export type Shop = {
  momoPhone: string;
  momoName: string;
  bank: string;
  account: string;
  holder: string;
  lifePrice: number;
  turnPrice: number;
  adsClient: string;
};

export function defaultWallet(): Wallet {
  return { turns: TURN_CAP, regenAt: 0, adTurnAt: 0 };
}

export function defaultShop(): Shop {
  return {
    momoPhone: "",
    momoName: "",
    bank: "",
    account: "",
    holder: "",
    lifePrice: 10000,
    turnPrice: 20000,
    adsClient: "",
  };
}

function clampPrice(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5_000_000, Math.max(1000, Math.round(n)));
}

export function loadWallet(): Wallet {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (!raw) return defaultWallet();
    const parsed = JSON.parse(raw) as Partial<Wallet>;
    const turns = typeof parsed.turns === "number" && parsed.turns >= 0 ? Math.floor(parsed.turns) : TURN_CAP;
    return tickWallet({
      turns,
      regenAt: typeof parsed.regenAt === "number" ? parsed.regenAt : 0,
      adTurnAt: typeof parsed.adTurnAt === "number" ? parsed.adTurnAt : 0,
    });
  } catch {
    return defaultWallet();
  }
}

export function saveWallet(wallet: Wallet) {
  localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
}

export function tickWallet(wallet: Wallet, now = Date.now()): Wallet {
  let { turns, regenAt } = wallet;
  if (turns >= TURN_CAP) return { ...wallet, turns, regenAt: 0 };
  if (regenAt <= 0) regenAt = now + REGEN_MS;
  while (turns < TURN_CAP && now >= regenAt) {
    turns += 1;
    regenAt += REGEN_MS;
  }
  if (turns >= TURN_CAP) regenAt = 0;
  return { ...wallet, turns, regenAt };
}

export function spendTurn(wallet: Wallet, now = Date.now()): Wallet | null {
  const ticked = tickWallet(wallet, now);
  if (ticked.turns <= 0) return null;
  const turns = ticked.turns - 1;
  return {
    ...ticked,
    turns,
    regenAt: turns >= TURN_CAP ? 0 : ticked.regenAt > 0 ? ticked.regenAt : now + REGEN_MS,
  };
}

export function grantTurns(wallet: Wallet, count: number, now = Date.now()): Wallet {
  const ticked = tickWallet(wallet, now);
  const turns = ticked.turns + count;
  return {
    ...ticked,
    turns,
    regenAt: turns >= TURN_CAP ? 0 : ticked.regenAt > 0 ? ticked.regenAt : now + REGEN_MS,
  };
}

export function canWatchTurnAd(wallet: Wallet, now = Date.now()) {
  const ticked = tickWallet(wallet, now);
  return ticked.turns <= 0 && now - ticked.adTurnAt >= REGEN_MS;
}

export function loadShop(): Shop {
  const base = defaultShop();
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Shop>;
    return {
      momoPhone: typeof parsed.momoPhone === "string" ? parsed.momoPhone.slice(0, 20) : "",
      momoName: typeof parsed.momoName === "string" ? parsed.momoName.slice(0, 40) : "",
      bank: typeof parsed.bank === "string" ? parsed.bank.slice(0, 40) : "",
      account: typeof parsed.account === "string" ? parsed.account.slice(0, 30) : "",
      holder: typeof parsed.holder === "string" ? parsed.holder.slice(0, 40) : "",
      lifePrice: clampPrice(parsed.lifePrice, base.lifePrice),
      turnPrice: clampPrice(parsed.turnPrice, base.turnPrice),
      adsClient: typeof parsed.adsClient === "string" ? parsed.adsClient.trim().slice(0, 32) : "",
    };
  } catch {
    return base;
  }
}

export function saveShop(shop: Shop) {
  localStorage.setItem(SHOP_KEY, JSON.stringify(shop));
}

export function shopReady(shop: Shop) {
  return shop.momoPhone.trim().length >= 9 || shop.account.trim().length >= 6;
}

export function isAdsClient(value: string) {
  return /^ca-pub-\d{8,20}$/.test(value.trim());
}

export function vnd(amount: number) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`;
}

export function formatRemain(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút ${s} giây`;
  return `${s} giây`;
}

export function transferMemo() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  return `HUNGBIA ${code}`;
}
