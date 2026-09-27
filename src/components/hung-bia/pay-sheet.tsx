import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { claimPayOrder, createPayOrder, loadPayOrder, type PayKind, type PayOrder } from "@/game/pay-client";
import { vnd } from "@/game/wallet";

export function PaySheet({
  title,
  detail,
  kind,
  onPaid,
  onClose,
}: {
  title: string;
  detail: string;
  kind: PayKind;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState("");
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    let stop = false;
    void createPayOrder(kind)
      .then((created) => {
        if (!stop) setOrder(created);
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : "Không tạo được đơn.");
      });
    return () => {
      stop = true;
    };
  }, [kind]);

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    const code = order.code;
    const expiresAt = order.expiresAt;
    let stop = false;
    const tick = async () => {
      const ms = expiresAt - Date.now();
      setLeft(ms > 0 ? `${Math.ceil(ms / 1000)} giây` : "hết hạn");
      try {
        const next = await loadPayOrder(code);
        if (stop) return;
        if (next.status === "paid") {
          const claimed = await claimPayOrder(code);
          if (stop) return;
          if (claimed.ok) onPaidRef.current();
          else setError("Đơn này đã được cộng trước đó.");
          return;
        }
        if (next.status === "pending") return;
        setOrder(next);
        if (next.status === "expired") setError("Hết hạn chuyển khoản. Đóng và tạo đơn mới.");
      } catch {
        /* giữ nguyên, thử lại */
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [order]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/85 p-4">
      <div className="my-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
        <h3 className="font-serif text-3xl leading-tight">{title}</h3>
        <p className="mt-2 text-sm text-muted">{detail}</p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        {!order && !error ? <p className="mt-4 text-muted">Đang tạo mã đơn...</p> : null}
        {order ? (
          <>
            <p className="mt-4 font-serif text-4xl tabular-nums">{vnd(order.amount)}</p>
            <p className="mt-2 text-sm text-muted">
              Nội dung chuyển khoản, đúng từng ký tự: <span className="font-semibold text-fg">{order.code}</span>
            </p>
            {order.qrUrl ? (
              <img src={order.qrUrl} alt="Mã QR chuyển khoản" className="mx-auto mt-3 w-56 rounded-xl bg-white" />
            ) : null}
            {order.account ? (
              <p className="mt-3 text-sm">
                {order.bankName} · <span className="font-semibold tabular-nums">{order.account}</span>
                {order.holder ? ` · ${order.holder}` : ""}
              </p>
            ) : null}
            {order.momoPayUrl ? (
              <a
                href={order.momoPayUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-fg"
              >
                Thanh toán MoMo
              </a>
            ) : null}
            {order.momoNote ? <p className="mt-2 text-sm text-danger">{order.momoNote}</p> : null}
            <p className="mt-3 text-sm text-muted">
              {order.status === "pending"
                ? `Đang chờ tiền vào đúng mã này. Còn ${left || "..."}.`
                : "Đơn không còn chờ."}
            </p>
          </>
        ) : null}
        <Button tone="quiet" size="lg" className="mt-4" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </div>
  );
}

export function DemoAd({ onDone }: { onDone: () => void }) {
  const [left, setLeft] = useState(5);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg p-6 text-center">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold tracking-widest text-primary">QUẢNG CÁO DEMO</p>
        <h2 className="mt-2 font-serif text-4xl">Giữ màn hình</h2>
        <p className="mt-3 text-muted">
          Chưa có mã Google AdSense. Quảng cáo thật chỉ chạy khi quản trị đã dán mã ca-pub. Phần thưởng chỉ cộng khi xem hết.
        </p>
        <p className="mt-6 font-serif text-6xl tabular-nums">{left}</p>
        <Button size="lg" className="mt-6" disabled={left > 0} onClick={onDone}>
          {left > 0 ? "Đang phát" : "Nhận thưởng"}
        </Button>
      </div>
    </div>
  );
}
