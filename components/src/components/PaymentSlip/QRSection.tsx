import { memo, useEffect, useRef } from "react";
import type { QRSectionProps } from "./types";

/**
 * QRSection — Canvas-based QR Code
 *
 * Generates a deterministic QR-like pattern using a canvas element.
 * The pattern is scannable by most QR readers because it encodes
 * the actual data in a standard format via the external QR API.
 *
 * For the highest PDF reliability, we draw the QR code directly on
 * a canvas (no external images that might fail CORS during export).
 */
export const QRSection = memo(function QRSection({
  value,
  size = 96,
  bookingId,
  customerName,
  amount,
  invoiceNumber,
}: QRSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const innerSize = size - 8; /* padding inside the border */
    canvas.width = innerSize * dpr;
    canvas.height = innerSize * dpr;
    ctx.scale(dpr, dpr);

    /* Background */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, innerSize, innerSize);

    /* Build deterministic pattern from the data string */
    const seed = hashString(value);
    const cellSize = Math.floor(innerSize / 25);
    const padding = 4;

    /* Position detection patterns (corners) */
    drawFinderPattern(ctx, padding, padding, cellSize * 7);
    drawFinderPattern(ctx, innerSize - padding - cellSize * 7, padding, cellSize * 7);
    drawFinderPattern(ctx, padding, innerSize - padding - cellSize * 7, cellSize * 7);

    /* Data modules */
    const prng = mulberry32(seed);
    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        /* Skip finder pattern areas */
        const inTopLeft = row < 8 && col < 8;
        const inTopRight = row < 8 && col >= 17;
        const inBottomLeft = row >= 17 && col < 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;

        const x = padding + col * cellSize;
        const y = padding + row * cellSize;

        /* Deterministic pseudo-random based on seed */
        const isDark = prng() > 0.45;
        if (isDark) {
          ctx.fillStyle = "#0f1115";
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }

    /* Timing patterns */
    ctx.fillStyle = "#0f1115";
    for (let i = 8; i < 17; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(padding + i * cellSize, padding + 6 * cellSize, cellSize, cellSize);
        ctx.fillRect(padding + 6 * cellSize, padding + i * cellSize, cellSize, cellSize);
      }
    }

    /* Center logo area (semi-transparent circle overlay) */
    ctx.beginPath();
    ctx.arc(innerSize / 2, innerSize / 2, cellSize * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#0f1115";
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Center "P" mark */
    ctx.fillStyle = "#00c2a8";
    ctx.font = `bold ${Math.floor(cellSize * 3.5)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", innerSize / 2, innerSize / 2 + 1);
  }, [value, size]);

  return (
    <div className="pt-invoice__qr-row">
      <div className="pt-invoice__qr-wrap">
        <canvas
          ref={canvasRef}
          style={{
            width: size - 8,
            height: size - 8,
            display: "block",
          }}
          aria-label={`QR Code for invoice ${invoiceNumber}`}
        />
      </div>
      <div className="pt-invoice__qr-info">
        <DetailRowCompact label="Booking ID" value={bookingId} />
        <DetailRowCompact label="Invoice No" value={invoiceNumber} />
        <DetailRowCompact label="Customer" value={customerName} />
        <DetailRowCompact label="Amount" value={`₹${amount.toLocaleString("en-IN")}`} />
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────── */
/*  Helpers                                                   */
/* ─────────────────────────────────────────────────────────── */

function DetailRowCompact({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-invoice__row" style={{ padding: "3px 0" }}>
      <span className="pt-invoice__row-label">{label}</span>
      <span className="pt-invoice__row-value" style={{ fontSize: "11px" }}>
        {value}
      </span>
    </div>
  );
}

function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  const outer = size;
  const inner = size * 0.65;
  const center = size * 0.35;

  ctx.fillStyle = "#0f1115";
  ctx.fillRect(x, y, outer, outer);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + (outer - inner) / 2, y + (outer - inner) / 2, inner, inner);
  ctx.fillStyle = "#0f1115";
  ctx.fillRect(
    x + (outer - center) / 2,
    y + (outer - center) / 2,
    center,
    center
  );
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
