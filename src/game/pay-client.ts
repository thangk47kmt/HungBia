export type PayKind = "life" | "turn";

export type PayPublic = {
  ready: boolean;
  bankArmed: boolean;
  momoArmed: boolean;
  hasPin: boolean;
  bankCode: string;
  bankName: string;
  account: string;
  holder: string;
  momoPhone: string;
  momoName: string;
  lifePrice: number;
  turnPrice: number;
};

export type PayOrder = PayPublic & {
  code: string;
  kind: PayKind;
  amount: number;
  status: "pending" | "paid" | "claimed" | "expired";
  qrUrl: string;
  momoPayUrl: string;
  momoQrUrl: string;
  momoNote: string;
  expiresAt: number;
};

async function read<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Không gọi được máy chủ thanh toán.");
  return data;
}

export function loadPayPublic() {
  return fetch("/api/pay/public").then((response) => read<PayPublic>(response));
}

export function createPayOrder(kind: PayKind) {
  return fetch("/api/pay/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind }),
  }).then((response) => read<PayOrder>(response));
}

export function loadPayOrder(code: string) {
  return fetch(`/api/pay/orders/${code}`).then((response) => read<PayOrder>(response));
}

export function claimPayOrder(code: string) {
  return fetch(`/api/pay/orders/${code}/claim`, { method: "POST" }).then((response) =>
    read<{ ok: boolean; kind?: PayKind; status?: string }>(response),
  );
}

export type PayAdminInput = {
  pin: string;
  bankCode: string;
  account: string;
  holder: string;
  momoPhone: string;
  momoName: string;
  lifePrice: number;
  turnPrice: number;
  sepayToken: string;
  clearSepay: boolean;
  webhookKey: string;
  clearWebhook: boolean;
  momoPartner: string;
  momoAccess: string;
  momoSecret: string;
  clearMomo: boolean;
  momoTest: boolean;
};

export function savePayAdmin(input: PayAdminInput) {
  return fetch("/api/pay/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then((response) =>
    read<PayPublic & { hasSepay: boolean; hasMomo: boolean; hasWebhook: boolean }>(response),
  );
}
