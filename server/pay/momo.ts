import { createHmac, timingSafeEqual } from "node:crypto";

export type MomoKeys = {
  partner: string;
  access: string;
  secret: string;
  test: boolean;
};

export type MomoCreated = {
  payUrl: string;
  qrUrl: string;
  message: string;
};

function sign(secret: string, raw: string) {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

function eqHex(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export async function createMomoPayment(
  keys: MomoKeys,
  order: { code: string; amount: number },
  urls: { ipn: string; redirect: string },
): Promise<MomoCreated> {
  const requestId = `${order.code}${Date.now()}`;
  const extraData = "";
  const orderInfo = `Hung Bia ${order.code}`;
  const requestType = "captureWallet";
  const raw = [
    `accessKey=${keys.access}`,
    `amount=${order.amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${urls.ipn}`,
    `orderId=${order.code}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${keys.partner}`,
    `redirectUrl=${urls.redirect}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&");
  const body = {
    partnerCode: keys.partner,
    partnerName: "Hung Bia",
    storeId: "HungBia",
    requestType,
    ipnUrl: urls.ipn,
    redirectUrl: urls.redirect,
    orderId: order.code,
    amount: order.amount,
    lang: "vi",
    orderInfo,
    requestId,
    extraData,
    autoCapture: true,
    signature: sign(keys.secret, raw),
  };
  const endpoint = keys.test
    ? "https://test-payment.momo.vn/v2/gateway/api/create"
    : "https://payment.momo.vn/v2/gateway/api/create";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await response.json()) as Record<string, unknown>;
  const resultCode = Number(json.resultCode);
  return {
    payUrl: resultCode === 0 && typeof json.payUrl === "string" ? json.payUrl : "",
    qrUrl: resultCode === 0 && typeof json.qrCodeUrl === "string" ? json.qrCodeUrl : "",
    message: typeof json.message === "string" ? json.message : "",
  };
}

export function momoIpnValid(keys: Pick<MomoKeys, "access" | "secret">, body: Record<string, unknown>) {
  const signature = typeof body.signature === "string" ? body.signature : "";
  const raw = [
    `accessKey=${keys.access}`,
    `amount=${body.amount ?? ""}`,
    `extraData=${body.extraData ?? ""}`,
    `message=${body.message ?? ""}`,
    `orderId=${body.orderId ?? ""}`,
    `orderInfo=${body.orderInfo ?? ""}`,
    `orderType=${body.orderType ?? ""}`,
    `partnerCode=${body.partnerCode ?? ""}`,
    `payType=${body.payType ?? ""}`,
    `requestId=${body.requestId ?? ""}`,
    `responseTime=${body.responseTime ?? ""}`,
    `resultCode=${body.resultCode ?? ""}`,
    `transId=${body.transId ?? ""}`,
  ].join("&");
  return eqHex(sign(keys.secret, raw), signature);
}
