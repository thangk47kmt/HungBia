import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BANKS } from "../../src/game/banks";
import { digits } from "./match";

const FILE = join(process.cwd(), "data", "pay-store.json");
const ORDER_MS = 15 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type PayKind = "life" | "turn";

export type PayOrder = {
  code: string;
  kind: PayKind;
  amount: number;
  status: "pending" | "paid" | "claimed" | "expired";
  createdAt: number;
  txId: string;
};

export type PayStore = {
  pinSalt: string;
  pinHash: string;
  bankCode: string;
  account: string;
  holder: string;
  momoPhone: string;
  momoName: string;
  lifePrice: number;
  turnPrice: number;
  sepayToken: string;
  webhookKey: string;
  momoPartner: string;
  momoAccess: string;
  momoSecret: string;
  momoTest: boolean;
  orders: PayOrder[];
  usedTx: string[];
};

export function emptyStore(): PayStore {
  return {
    pinSalt: "",
    pinHash: "",
    bankCode: "MB",
    account: "",
    holder: "",
    momoPhone: "",
    momoName: "",
    lifePrice: 10000,
    turnPrice: 20000,
    sepayToken: "",
    webhookKey: "",
    momoPartner: "",
    momoAccess: "",
    momoSecret: "",
    momoTest: false,
    orders: [],
    usedTx: [],
  };
}

export function clampPrice(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5_000_000, Math.max(1000, Math.round(n)));
}

export function bankArmed(store: PayStore) {
  return Boolean(store.sepayToken && store.account && BANKS.some((bank) => bank.code === store.bankCode));
}

export function momoArmed(store: PayStore) {
  return Boolean(store.momoPartner && store.momoAccess && store.momoSecret);
}

function hashPin(pin: string, salt: string) {
  return createHash("sha256").update(`${salt}:${pin}`).digest("hex");
}

export function pinOk(store: PayStore, pin: string) {
  if (!store.pinHash || !store.pinSalt || pin.length < 4) return false;
  const next = Buffer.from(hashPin(pin, store.pinSalt));
  const prev = Buffer.from(store.pinHash);
  return next.length === prev.length && timingSafeEqual(next, prev);
}

export function setPin(store: PayStore, pin: string) {
  store.pinSalt = randomBytes(16).toString("hex");
  store.pinHash = hashPin(pin, store.pinSalt);
}

export function freshCode() {
  let code = "HB";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function accountDigits(store: PayStore) {
  return digits(store.account);
}

function readStore(): PayStore {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<PayStore>;
    const base = emptyStore();
    return {
      ...base,
      ...parsed,
      bankCode: BANKS.some((bank) => bank.code === parsed.bankCode) ? parsed.bankCode! : base.bankCode,
      lifePrice: clampPrice(parsed.lifePrice, base.lifePrice),
      turnPrice: clampPrice(parsed.turnPrice, base.turnPrice),
      orders: Array.isArray(parsed.orders) ? parsed.orders.filter(validOrder) : [],
      usedTx: Array.isArray(parsed.usedTx) ? parsed.usedTx.filter((id) => typeof id === "string").slice(-400) : [],
      momoTest: parsed.momoTest === true,
    };
  } catch {
    return emptyStore();
  }
}

function validOrder(value: unknown): value is PayOrder {
  if (!value || typeof value !== "object") return false;
  const row = value as PayOrder;
  return (
    typeof row.code === "string" &&
    (row.kind === "life" || row.kind === "turn") &&
    typeof row.amount === "number" &&
    (row.status === "pending" || row.status === "paid" || row.status === "claimed" || row.status === "expired") &&
    typeof row.createdAt === "number"
  );
}

function writeStore(store: PayStore) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  store.orders = store.orders.filter((order) => order.createdAt > cutoff || order.status === "pending" || order.status === "paid");
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, FILE);
}

let tail: Promise<void> = Promise.resolve();

export function withStore<T>(fn: (store: PayStore) => Promise<T> | T): Promise<T> {
  const job = tail.then(async () => {
    const store = readStore();
    const result = await fn(store);
    writeStore(store);
    return result;
  });
  tail = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function expireOrders(store: PayStore, now = Date.now()) {
  for (const order of store.orders) {
    if (order.status === "pending" && now - order.createdAt > ORDER_MS) order.status = "expired";
  }
}

export function orderExpiry(order: PayOrder) {
  return order.createdAt + ORDER_MS;
}
