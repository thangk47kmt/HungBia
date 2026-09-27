import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { collectTx, txPaysOrder } from "./match.ts";
import { momoIpnValid } from "./momo.ts";

test("sepay content with the order code pays that order", () => {
  const [tx] = collectTx({
    transactions: [
      {
        id: "99",
        account_number: "01234999",
        amount_in: "10000.00",
        amount_out: "0.00",
        transaction_content: "NGUYEN VAN A HB7K2MQ9AB",
        code: null,
        transaction_date: "2026-09-27 09:00:00",
      },
    ],
  });
  assert.ok(tx);
  assert.equal(
    txPaysOrder(tx, { code: "HB7K2MQ9AB".slice(0, 10), amount: 10000, createdAt: Date.parse("2026-09-27T08:59:00") }, "01234999"),
    true,
  );
});

test("wrong amount or other account does not pay", () => {
  const [tx] = collectTx({
    id: 5,
    transferType: "in",
    transferAmount: 20000,
    content: "HBABCD2345",
    accountNumber: "111",
    code: "HBABCD2345",
  });
  assert.ok(tx);
  const order = { code: "HBABCD2345", amount: 10000, createdAt: 1 };
  assert.equal(txPaysOrder(tx, order, "111"), false);
  assert.equal(txPaysOrder({ ...tx, amount: 10000 }, order, "222"), false);
  assert.equal(txPaysOrder({ ...tx, amount: 10000 }, order, "111"), true);
});

test("momo ipn signature must match", () => {
  const secret = "topsecret";
  const access = "access";
  const body: Record<string, unknown> = {
    amount: 10000,
    extraData: "",
    message: "Successful.",
    orderId: "HBABCD2345",
    orderInfo: "Hung Bia HBABCD2345",
    orderType: "momo_wallet",
    partnerCode: "MOMO",
    payType: "qr",
    requestId: "req1",
    responseTime: 10,
    resultCode: 0,
    transId: 99,
  };
  const raw = [
    `accessKey=${access}`,
    `amount=${body.amount}`,
    `extraData=${body.extraData}`,
    `message=${body.message}`,
    `orderId=${body.orderId}`,
    `orderInfo=${body.orderInfo}`,
    `orderType=${body.orderType}`,
    `partnerCode=${body.partnerCode}`,
    `payType=${body.payType}`,
    `requestId=${body.requestId}`,
    `responseTime=${body.responseTime}`,
    `resultCode=${body.resultCode}`,
    `transId=${body.transId}`,
  ].join("&");
  body.signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(momoIpnValid({ access, secret }, body), true);
  assert.equal(momoIpnValid({ access, secret }, { ...body, amount: 1 }), false);
});
