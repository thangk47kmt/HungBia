import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BANKS } from "@/game/banks";
import { loadPayPublic, savePayAdmin, type PayPublic } from "@/game/pay-client";

const fieldClass =
  "mt-1 h-12 w-full rounded-xl border border-line bg-bg px-4 text-fg outline-none focus:border-primary";

export function PayAdmin({ onSaved }: { onSaved: (pub: PayPublic) => void }) {
  const [pin, setPin] = useState("");
  const [bankCode, setBankCode] = useState("MB");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState("");
  const [momoPhone, setMomoPhone] = useState("");
  const [momoName, setMomoName] = useState("");
  const [lifePrice, setLifePrice] = useState(10000);
  const [turnPrice, setTurnPrice] = useState(20000);
  const [sepayToken, setSepayToken] = useState("");
  const [webhookKey, setWebhookKey] = useState("");
  const [momoPartner, setMomoPartner] = useState("");
  const [momoAccess, setMomoAccess] = useState("");
  const [momoSecret, setMomoSecret] = useState("");
  const [momoTest, setMomoTest] = useState(false);
  const [clearSepay, setClearSepay] = useState(false);
  const [clearMomo, setClearMomo] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pub, setPub] = useState<PayPublic | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    void loadPayPublic()
      .then((next) => {
        setPub(next);
        setBankCode(next.bankCode || "MB");
        setAccount(next.account);
        setHolder(next.holder);
        setMomoPhone(next.momoPhone);
        setMomoName(next.momoName);
        setLifePrice(next.lifePrice);
        setTurnPrice(next.turnPrice);
      })
      .catch(() => setError("Chưa gọi được máy chủ thanh toán."));
  }, []);

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setNote("");
        void savePayAdmin({
          pin,
          bankCode,
          account,
          holder,
          momoPhone,
          momoName,
          lifePrice,
          turnPrice,
          sepayToken,
          clearSepay,
          webhookKey,
          clearWebhook: false,
          momoPartner,
          momoAccess,
          momoSecret,
          clearMomo,
          momoTest,
        })
          .then((saved) => {
            setPub(saved);
            setSepayToken("");
            setWebhookKey("");
            setMomoPartner("");
            setMomoAccess("");
            setMomoSecret("");
            setClearSepay(false);
            setClearMomo(false);
            setNote(
              saved.bankArmed || saved.momoArmed
                ? "Đã lưu. Tiền vào đúng mã đơn sẽ tự cộng."
                : "Đã lưu số tài khoản, nhưng chưa có token SePay hoặc khóa MoMo nên chưa tự đối soát.",
            );
            onSaved(saved);
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không lưu được."))
          .finally(() => setBusy(false));
      }}
    >
      <h2 className="font-semibold">Gắn tài khoản nhận tiền</h2>
      <p className="text-sm text-muted">
        Mỗi lần nạp, game tạo một mã đơn. SePay đọc sao kê ngân hàng, hoặc MoMo doanh nghiệp gọi IPN. Khớp đúng mã và
        đúng số tiền thì tự cộng mạng hoặc lượt. Ví MoMo cá nhân không có API sao kê.
      </p>
      {pub ? (
        <p className="text-sm">
          Ngân hàng: {pub.bankArmed ? "đang đối soát" : "chưa bật"} · MoMo: {pub.momoArmed ? "đang đối soát" : "chưa bật"}
        </p>
      ) : null}
      <label className="block text-sm text-muted" htmlFor="pay-pin">
        {pub?.hasPin ? "Mã quản trị" : "Đặt mã quản trị"}
        <input
          id="pay-pin"
          type="password"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-muted" htmlFor="pay-bank">
        Ngân hàng
        <select
          id="pay-bank"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className={fieldClass}
        >
          {BANKS.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-muted" htmlFor="pay-account">
        Số tài khoản
        <input
          id="pay-account"
          inputMode="numeric"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-muted" htmlFor="pay-holder">
        Chủ tài khoản
        <input id="pay-holder" value={holder} maxLength={40} onChange={(e) => setHolder(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-muted" htmlFor="pay-sepay">
        API token SePay
        <input
          id="pay-sepay"
          type="password"
          value={sepayToken}
          placeholder="Dán token từ my.sepay.vn — để trống nếu giữ token cũ"
          onChange={(e) => setSepayToken(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-primary" checked={clearSepay} onChange={(e) => setClearSepay(e.target.checked)} />
        Xóa token SePay đã lưu
      </label>
      <label className="block text-sm text-muted" htmlFor="pay-hook">
        Khóa webhook SePay, nếu có
        <input
          id="pay-hook"
          type="password"
          value={webhookKey}
          placeholder="Không có thì webhook dùng chính token SePay"
          onChange={(e) => setWebhookKey(e.target.value)}
          className={fieldClass}
        />
      </label>
      <p className="break-all text-xs text-muted">Webhook SePay: {origin}/api/pay/hook/sepay</p>
      <label className="block text-sm text-muted" htmlFor="momo-phone">
        Số MoMo hiện trên màn hình
        <input
          id="momo-phone"
          inputMode="numeric"
          value={momoPhone}
          onChange={(e) => setMomoPhone(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-muted" htmlFor="momo-name">
        Tên chủ MoMo
        <input id="momo-name" value={momoName} maxLength={40} onChange={(e) => setMomoName(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-muted" htmlFor="momo-partner">
        MoMo partnerCode
        <input id="momo-partner" value={momoPartner} onChange={(e) => setMomoPartner(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-muted" htmlFor="momo-access">
        MoMo accessKey
        <input id="momo-access" type="password" value={momoAccess} onChange={(e) => setMomoAccess(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm text-muted" htmlFor="momo-secret">
        MoMo secretKey
        <input id="momo-secret" type="password" value={momoSecret} onChange={(e) => setMomoSecret(e.target.value)} className={fieldClass} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-primary" checked={momoTest} onChange={(e) => setMomoTest(e.target.checked)} />
        Dùng MoMo thử nghiệm
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5 accent-primary" checked={clearMomo} onChange={(e) => setClearMomo(e.target.checked)} />
        Xóa khóa MoMo đã lưu
      </label>
      <p className="break-all text-xs text-muted">IPN MoMo: {origin}/api/pay/hook/momo</p>
      <label className="block text-sm text-muted" htmlFor="life-price">
        Giá 1 mạng
        <input
          id="life-price"
          inputMode="numeric"
          value={lifePrice}
          onChange={(e) => setLifePrice(Number(e.target.value))}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-muted" htmlFor="turn-price">
        Giá 1 lượt
        <input
          id="turn-price"
          inputMode="numeric"
          value={turnPrice}
          onChange={(e) => setTurnPrice(Number(e.target.value))}
          className={fieldClass}
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {note ? <p className="text-sm text-primary">{note}</p> : null}
      <Button size="lg" type="submit" disabled={busy || pin.trim().length < 4}>
        {busy ? "Đang lưu" : "Lưu tài khoản nhận tiền"}
      </Button>
    </form>
  );
}
