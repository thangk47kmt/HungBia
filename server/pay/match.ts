export type Tx = {
  id: string;
  amount: number;
  content: string;
  code: string;
  account: string;
  incoming: boolean;
  at: number;
};

export type Payable = {
  code: string;
  amount: number;
  createdAt: number;
};

const CODE_RE = /^HB[A-Z2-9]{8}$/;

export function isOrderCode(value: string) {
  return CODE_RE.test(value);
}

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function txPaysOrder(tx: Tx, order: Payable, accountDigits: string) {
  if (!tx.incoming || !tx.id) return false;
  if (tx.amount !== order.amount) return false;
  if (tx.at > 0 && tx.at + 120_000 < order.createdAt) return false;
  if (accountDigits && digits(tx.account) && digits(tx.account) !== accountDigits) return false;
  const blob = `${tx.code} ${tx.content}`.toUpperCase();
  return blob.includes(order.code.toUpperCase());
}

function num(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function when(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeTx(raw: unknown): Tx | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const amountIn = num(row.amount_in ?? row.amountIn);
  const transferAmount = num(row.transferAmount ?? row.transfer_amount);
  const transferType = text(row.transferType ?? row.transfer_type).toLowerCase();
  const incoming = transferType ? transferType === "in" : amountIn > 0 || transferAmount > 0;
  const amount = amountIn || transferAmount || num(row.amount);
  const id = text(row.id ?? row.referenceCode ?? row.reference_number);
  if (!id || amount <= 0) return null;
  return {
    id,
    amount,
    content: text(row.transaction_content ?? row.transactionContent ?? row.content ?? row.description),
    code: text(row.code),
    account: text(row.accountNumber ?? row.account_number ?? row.account),
    incoming,
    at: when(row.transactionDate ?? row.transaction_date ?? row.transactionDateTime),
  };
}

export function collectTx(payload: unknown): Tx[] {
  if (Array.isArray(payload)) return payload.map(normalizeTx).filter((tx): tx is Tx => tx != null);
  if (!payload || typeof payload !== "object") return [];
  const row = payload as Record<string, unknown>;
  const lists = [row.transactions, row.data, row.records];
  for (const list of lists) {
    if (Array.isArray(list)) return list.map(normalizeTx).filter((tx): tx is Tx => tx != null);
  }
  const one = normalizeTx(payload);
  return one ? [one] : [];
}
