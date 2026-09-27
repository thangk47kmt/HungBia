import { collectTx, type Tx } from "./match";

export async function fetchSepay(token: string): Promise<Tx[]> {
  const response = await fetch("https://my.sepay.vn/userapi/transactions/list?limit=30", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`SePay ${response.status}`);
  return collectTx(await response.json());
}
