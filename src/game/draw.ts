import type { Sim } from "@/game/sim";

function shade(hex: string, amt: number) {
  const n = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `rgb(${r} ${g} ${b})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCan(ctx: CanvasRenderingContext2D, sim: Sim, x: number, y: number, w: number, h: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const left = -w / 2;
  const top = -h / 2;
  const g = ctx.createLinearGradient(left, 0, left + w, 0);
  g.addColorStop(0, shade(sim.body, -28));
  g.addColorStop(0.4, sim.body);
  g.addColorStop(0.72, shade(sim.body, 28));
  g.addColorStop(1, shade(sim.body, -12));
  ctx.fillStyle = g;
  roundRect(ctx, left, top + 7, w, h - 9, 7);
  ctx.fill();
  ctx.fillStyle = sim.cap;
  roundRect(ctx, left + 1, top, w - 2, 11, 4);
  ctx.fill();
  ctx.fillStyle = sim.label;
  ctx.fillRect(left + 3, top + h * 0.4, w - 6, h * 0.28);
  ctx.fillStyle = "#1c1308";
  ctx.font = "700 11px 'Be Vietnam Pro', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sim.mark, 0, top + h * 0.54);
  ctx.restore();
}

function drawBottle(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = shade(sim.body, 18);
  roundRect(ctx, -w * 0.16, -h / 2, w * 0.32, h * 0.28, 4);
  ctx.fill();
  ctx.fillStyle = sim.cap;
  roundRect(ctx, -w * 0.18, -h / 2, w * 0.36, 9, 3);
  ctx.fill();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(sim.body, -24));
  g.addColorStop(0.45, sim.body);
  g.addColorStop(1, shade(sim.body, 16));
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -h / 2 + h * 0.22, w, h * 0.78, 9);
  ctx.fill();
  ctx.fillStyle = sim.label;
  ctx.fillRect(-w / 2 + 3, -h * 0.02, w - 6, h * 0.26);
  ctx.fillStyle = "#1c1308";
  ctx.font = "700 10px 'Be Vietnam Pro', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sim.mark, 0, h * 0.1);
  ctx.restore();
}

function drawBucket(ctx: CanvasRenderingContext2D, sim: Sim) {
  const { bucketX, bucketY, bucketW, bucketH, squash } = sim;
  ctx.save();
  ctx.translate(bucketX, bucketY + bucketH);
  ctx.scale(1 + squash, 1 - squash * 0.55);
  ctx.translate(-bucketW / 2, -bucketH);
  const g = ctx.createLinearGradient(0, 0, bucketW, bucketH);
  g.addColorStop(0, "#a56b3c");
  g.addColorStop(0.45, "#6b4124");
  g.addColorStop(1, "#3d2616");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bucketW * 0.08, 4);
  ctx.lineTo(bucketW * 0.92, 4);
  ctx.lineTo(bucketW, bucketH);
  ctx.lineTo(0, bucketH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6d3b0";
  ctx.fillRect(bucketW * 0.06, bucketH * 0.28, bucketW * 0.88, 4);
  ctx.fillRect(bucketW * 0.02, bucketH * 0.66, bucketW * 0.96, 4);
  ctx.fillStyle = "#fff8ee";
  ctx.beginPath();
  ctx.ellipse(bucketW / 2, 8, bucketW * 0.36, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0b429";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(bucketW / 2, 10, bucketW * 0.2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  bg: HTMLImageElement | null,
  reduced: boolean,
) {
  const dpr = sim.w > 0 ? ctx.canvas.width / sim.w : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sim.w, sim.h);

  const mag = reduced ? 0 : sim.shake;
  ctx.save();
  ctx.translate((Math.random() - 0.5) * mag * 8, (Math.random() - 0.5) * mag * 5);

  if (bg && bg.naturalWidth) {
    const scale = Math.max(sim.w / bg.naturalWidth, sim.h / bg.naturalHeight);
    const dw = bg.naturalWidth * scale;
    const dh = bg.naturalHeight * scale;
    ctx.drawImage(bg, (sim.w - dw) / 2, (sim.h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, sim.h);
    g.addColorStop(0, "#3a2418");
    g.addColorStop(1, "#140e0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sim.w, sim.h);
  }

  const veil = ctx.createLinearGradient(0, 0, 0, sim.h);
  veil.addColorStop(0, "rgba(20,14,10,0.2)");
  veil.addColorStop(0.5, "rgba(20,14,10,0.05)");
  veil.addColorStop(1, "rgba(20,14,10,0.78)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, sim.w, sim.h);

  ctx.fillStyle = "#3a2618";
  ctx.fillRect(0, sim.floor, sim.w, sim.h - sim.floor);
  ctx.fillStyle = "#c6a15a";
  ctx.fillRect(0, sim.floor, sim.w, 3);

  for (const item of sim.items) {
    if (item.pace === "fast") {
      ctx.strokeStyle = "rgba(255,248,238,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - item.h * 0.35);
      ctx.lineTo(item.x, item.y - item.h * 1.05);
      ctx.stroke();
    }
    if (sim.kind === "bottle") drawBottle(ctx, sim, item.x, item.y, item.w, item.h, item.rot);
    else drawCan(ctx, sim, item.x, item.y, item.w, item.h, item.rot);
  }

  for (const p of sim.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawBucket(ctx, sim);

  ctx.font = "700 16px 'Be Vietnam Pro', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of sim.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = "#1c1308";
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = "#fff8ee";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (!reduced && sim.flash > 0) {
    ctx.fillStyle = `rgba(225, 93, 76, ${sim.flash * 0.28})`;
    ctx.fillRect(0, 0, sim.w, sim.h);
  }
}
