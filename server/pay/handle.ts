import { timingSafeEqual } from "node:crypto";
import { BANKS, bankName } from "../../src/game/banks";
import { collectTx, digits, isOrderCode, txPaysOrder, type Tx } from "./match";
import { createMomoPayment, momoIpnValid } from "./momo";
import { fetchSepay } from "./sepay";
import {
  accountDigits,
  bankArmed,
  clampPrice,
  emptyStore,
  expireOrders,
  freshCode,
  momoArmed,
  orderExpiry,
  pinOk,
  setPin,
  withStore,
  type PayKind,
  type PayOrder,
  type PayStore,
} from "./store";

const BANK_CODES = new Set<string>(BANKS.map((bank) => bank.code));

let cacheAt = 0;
let cacheTx: Tx[] = [];
let fetching: Promise<Tx[]> | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function secretEq(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function presentedSecret(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const trimmed = auth.replace(/^(Bearer|Apikey)\s+/i, "").trim();
  return trimmed || request.headers.get("x-api-key") || request.headers.get("x-secret-key") || "";
}

function originOf(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = forwarded ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function qrUrl(store: PayStore, amount: number, code: string) {
  if (!store.account || !store.bankCode) return "";
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: code,
    accountName: store.holder || "HUNG BIA",
  });
  return `https://img.vietqr.io/image/${store.bankCode}-${digits(store.account)}-compact2.png?${params}`;
}

function publicView(store: PayStore) {
  return {
    ready: bankArmed(store) || momoArmed(store),
    bankArmed: bankArmed(store),
    momoArmed: momoArmed(store),
    hasPin: Boolean(store.pinHash),
    bankCode: store.bankCode,
    bankName: bankName(store.bankCode),
    account: store.account,
    holder: store.holder,
    momoPhone: store.momoPhone,
    momoName: store.momoName,
    lifePrice: store.lifePrice,
    turnPrice: store.turnPrice,
  };
}

function orderView(store: PayStore, order: PayOrder, extra?: { momoPayUrl?: string; momoQrUrl?: string; momoNote?: string }) {
  return {
    code: order.code,
    kind: order.kind,
    amount: order.amount,
    status: order.status,
    qrUrl: qrUrl(store, order.amount, order.code),
    momoPayUrl: extra?.momoPayUrl ?? "",
    momoQrUrl: extra?.momoQrUrl ?? "",
    momoNote: extra?.momoNote ?? "",
    bankCode: store.bankCode,
    bankName: bankName(store.bankCode),
    account: store.account,
    holder: store.holder,
    momoPhone: store.momoPhone,
    momoName: store.momoName,
    expiresAt: orderExpiry(order),
  };
}

async function sepayTx(store: PayStore): Promise<Tx[]> {
  if (!store.sepayToken) return [];
  const now = Date.now();
  if (now - cacheAt < 4000) return cacheTx;
  if (!fetching) {
    fetching = fetchSepay(store.sepayToken)
      .then((rows) => {
        cacheTx = rows;
        cacheAt = Date.now();
        return rows;
      })
      .catch((err) => {
        console.error("[pay] SePay", err instanceof Error ? err.message : "lỗi");
        return cacheTx;
      })
      .finally(() => {
        fetching = null;
      });
  }
  return fetching;
}

function applyTx(store: PayStore, rows: Tx[], source: string) {
  expireOrders(store);
  const account = accountDigits(store);
  for (const tx of rows) {
    const txId = `${source}:${tx.id}`;
    if (store.usedTx.includes(txId)) continue;
    const order = store.orders.find((item) => item.status === "pending" && txPaysOrder(tx, item, account));
    if (!order) continue;
    order.status = "paid";
    order.txId = txId;
    store.usedTx.push(txId);
  }
}

async function reconcile(store: PayStore) {
  expireOrders(store);
  if (!store.orders.some((order) => order.status === "pending") || !store.sepayToken) return;
  applyTx(store, await sepayTx(store), "sepay");
}

function priceOf(store: PayStore, kind: PayKind) {
  return kind === "life" ? store.lifePrice : store.turnPrice;
}

async function createOrder(request: Request, store: PayStore) {
  if (!bankArmed(store) && !momoArmed(store)) {
    return json({ error: "Chưa gắn API SePay hoặc MoMo doanh nghiệp trong Quản trị." }, 409);
  }
  const body = (await request.json().catch(() => null)) as { kind?: string } | null;
  const kind: PayKind | null = body?.kind === "life" || body?.kind === "turn" ? body.kind : null;
  if (!kind) return json({ error: "Thiếu loại đơn." }, 400);
  const pending = store.orders.filter((order) => order.status === "pending");
  if (pending.length > 40) return json({ error: "Quá nhiều đơn đang chờ." }, 429);
  const order: PayOrder = {
    code: freshCode(),
    kind,
    amount: priceOf(store, kind),
    status: "pending",
    createdAt: Date.now(),
    txId: "",
  };
  store.orders.push(order);
  let momoPayUrl = "";
  let momoQrUrl = "";
  let momoNote = "";
  if (momoArmed(store)) {
    const origin = originOf(request);
    try {
      const created = await createMomoPayment(
        {
          partner: store.momoPartner,
          access: store.momoAccess,
          secret: store.momoSecret,
          test: store.momoTest,
        },
        order,
        { ipn: `${origin}/api/pay/hook/momo`, redirect: `${origin}/?pay=${order.code}` },
      );
      momoPayUrl = created.payUrl;
      momoQrUrl = created.qrUrl;
      momoNote = created.payUrl ? "" : created.message || "MoMo không tạo được đơn.";
    } catch (err) {
      momoNote = err instanceof Error ? err.message : "MoMo lỗi.";
      console.error("[pay] MoMo", momoNote);
    }
  }
  return json(orderView(store, order, { momoPayUrl, momoQrUrl, momoNote }));
}

function findOrder(store: PayStore, code: string) {
  return store.orders.find((order) => order.code === code) ?? null;
}

async function saveAdmin(request: Request, store: PayStore) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Thiếu dữ liệu." }, 400);
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (pin.length < 4 || pin.length > 32) return json({ error: "Mã quản trị từ 4 đến 32 ký tự." }, 400);
  if (store.pinHash) {
    if (!pinOk(store, pin)) return json({ error: "Sai mã quản trị." }, 401);
  } else {
    setPin(store, pin);
  }
  const bankCode = typeof body.bankCode === "string" ? body.bankCode : store.bankCode;
  if (typeof bankCode === "string" && BANK_CODES.has(bankCode)) store.bankCode = bankCode;
  if (typeof body.account === "string") store.account = digits(body.account).slice(0, 19);
  if (typeof body.holder === "string") store.holder = body.holder.trim().slice(0, 40);
  if (typeof body.momoPhone === "string") store.momoPhone = body.momoPhone.replace(/[^\d+]/g, "").slice(0, 15);
  if (typeof body.momoName === "string") store.momoName = body.momoName.trim().slice(0, 40);
  store.lifePrice = clampPrice(body.lifePrice, store.lifePrice);
  store.turnPrice = clampPrice(body.turnPrice, store.turnPrice);
  if (typeof body.sepayToken === "string" && body.sepayToken.trim()) store.sepayToken = body.sepayToken.trim();
  if (body.clearSepay === true) store.sepayToken = "";
  if (typeof body.webhookKey === "string" && body.webhookKey.trim()) store.webhookKey = body.webhookKey.trim();
  if (body.clearWebhook === true) store.webhookKey = "";
  if (typeof body.momoPartner === "string" && body.momoPartner.trim()) store.momoPartner = body.momoPartner.trim();
  if (typeof body.momoAccess === "string" && body.momoAccess.trim()) store.momoAccess = body.momoAccess.trim();
  if (typeof body.momoSecret === "string" && body.momoSecret.trim()) store.momoSecret = body.momoSecret.trim();
  if (body.clearMomo === true) {
    store.momoPartner = "";
    store.momoAccess = "";
    store.momoSecret = "";
  }
  store.momoTest = body.momoTest === true;
  cacheAt = 0;
  return json({
    ...publicView(store),
    hasSepay: Boolean(store.sepayToken),
    hasMomo: momoArmed(store),
    hasWebhook: Boolean(store.webhookKey),
  });
}

async function hookSepay(request: Request, store: PayStore) {
  const expected = store.webhookKey || store.sepayToken;
  if (!secretEq(presentedSecret(request), expected)) return json({ error: "Sai khóa webhook." }, 401);
  const payload = await request.json().catch(() => null);
  applyTx(store, collectTx(payload), "sepay");
  return json({ success: true });
}

async function hookMomo(request: Request, store: PayStore) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !momoArmed(store)) return new Response(null, { status: 204 });
  if (!momoIpnValid({ access: store.momoAccess, secret: store.momoSecret }, body)) {
    return json({ error: "Sai chữ ký MoMo." }, 400);
  }
  const code = typeof body.orderId === "string" ? body.orderId : "";
  const order = findOrder(store, code);
  const amount = Number(body.amount);
  const transId = body.transId == null ? "" : String(body.transId);
  if (
    order &&
    order.status === "pending" &&
    Number(body.resultCode) === 0 &&
    amount === order.amount &&
    transId &&
    !store.usedTx.includes(`momo:${transId}`)
  ) {
    order.status = "paid";
    order.txId = `momo:${transId}`;
    store.usedTx.push(order.txId);
  }
  return new Response(null, { status: 204 });
}

export async function handlePayRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (path === "/api/pay/public" && method === "GET") {
    return withStore((store) => json(publicView(store)));
  }

  if (path === "/api/pay/orders" && method === "POST") {
    return withStore((store) => createOrder(request, store));
  }

  const orderPath = path.match(/^\/api\/pay\/orders\/(HB[A-Z2-9]{8})(\/claim)?$/);
  if (orderPath && method === "GET" && !orderPath[2]) {
    const code = orderPath[1]!;
    if (!isOrderCode(code)) return json({ error: "Mã đơn không đúng." }, 404);
    return withStore(async (store) => {
      await reconcile(store);
      const order = findOrder(store, code);
      if (!order) return json({ error: "Không thấy đơn." }, 404);
      return json(orderView(store, order));
    });
  }

  if (orderPath && method === "POST" && orderPath[2] === "/claim") {
    const code = orderPath[1]!;
    return withStore(async (store) => {
      await reconcile(store);
      const order = findOrder(store, code);
      if (!order) return json({ error: "Không thấy đơn." }, 404);
      if (order.status !== "paid") return json({ ok: false, status: order.status });
      order.status = "claimed";
      return json({ ok: true, kind: order.kind, amount: order.amount });
    });
  }

  if (path === "/api/pay/admin" && method === "POST") {
    return withStore((store) => saveAdmin(request, store));
  }

  if (path === "/api/pay/hook/sepay" && method === "POST") {
    return withStore((store) => hookSepay(request, store));
  }

  if (path === "/api/pay/hook/momo" && method === "POST") {
    return withStore((store) => hookMomo(request, store));
  }

  if (path === "/api/pay/health" && method === "GET") {
    return json({ ok: true, store: emptyStore().bankCode });
  }

  return json({ error: "Không có đường dẫn này." }, 404);
}
