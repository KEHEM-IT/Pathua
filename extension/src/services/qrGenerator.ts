// QR generation and "smart content" string-building.
//
// Design note: the original spec names "QRCode.js" (davidshimjs/qrcodejs), a
// long-unmaintained 2012-era canvas library with no TypeScript types and no
// SVG output. We use the actively maintained `qrcode` npm package instead —
// same job (client-side, zero-network QR rendering), but it ships types,
// supports both canvas/PNG-dataURL and true SVG string output (needed for
// "Download QR SVG"), and configurable error-correction levels out of the box.

import QRCode from "qrcode";
import type { QrCustomizationOptions, SmartQrInput } from "../types";

/** Builds the raw string payload encoded into the QR, based on content type. */
export function buildQrContent(input: SmartQrInput): string {
  switch (input.type) {
    case "url":
      return input.url ?? "";
    case "text":
      return input.text ?? "";
    case "email":
      return `mailto:${input.email ?? ""}`;
    case "phone":
      return `tel:${input.phone ?? ""}`;
    case "whatsapp": {
      const phone = (input.phone ?? "").replace(/[^\d+]/g, "");
      const text = encodeURIComponent(input.whatsappMessage ?? "");
      return `https://wa.me/${phone}${text ? `?text=${text}` : ""}`;
    }
    case "sms": {
      const phone = input.phone ?? "";
      const body = encodeURIComponent(input.smsMessage ?? "");
      return `sms:${phone}${body ? `?body=${body}` : ""}`;
    }
    case "wifi": {
      const w = input.wifi;
      if (!w) return "";
      const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
      return `WIFI:T:${w.security};S:${esc(w.ssid)};P:${esc(w.password)};${
        w.hidden ? "H:true;" : ""
      }`;
    }
    case "vcard": {
      const v = input.vcard;
      if (!v) return "";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${v.lastName};${v.firstName}`,
        `FN:${v.firstName} ${v.lastName}`,
        v.org ? `ORG:${v.org}` : "",
        v.phone ? `TEL:${v.phone}` : "",
        v.email ? `EMAIL:${v.email}` : "",
        v.url ? `URL:${v.url}` : "",
        "END:VCARD",
      ];
      return lines.filter(Boolean).join("\n");
    }
    case "event": {
      const e = input.event;
      if (!e) return "";
      const fmt = (iso: string) => iso.replace(/[-:]/g, "").split(".")[0] + "Z";
      const lines = [
        "BEGIN:VEVENT",
        `SUMMARY:${e.title}`,
        `DTSTART:${fmt(e.start)}`,
        `DTEND:${fmt(e.end)}`,
        e.location ? `LOCATION:${e.location}` : "",
        e.description ? `DESCRIPTION:${e.description}` : "",
        "END:VEVENT",
      ];
      return lines.filter(Boolean).join("\n");
    }
    default:
      return "";
  }
}

export async function generateQrPngDataUrl(
  content: string,
  options: QrCustomizationOptions
): Promise<string> {
  return QRCode.toDataURL(content, {
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: options.errorCorrection,
    color: { dark: options.color, light: options.backgroundColor },
  });
}

export async function generateQrSvgString(
  content: string,
  options: QrCustomizationOptions
): Promise<string> {
  return QRCode.toString(content, {
    type: "svg",
    width: options.size,
    margin: options.margin,
    errorCorrectionLevel: options.errorCorrection,
    color: { dark: options.color, light: options.backgroundColor },
  });
}

/**
 * Composites an embedded logo over a rendered PNG data URL using an
 * OffscreenCanvas (available in MV3 service workers and popup documents
 * alike), so this works whether it's called from the popup or background.
 */
export async function embedLogo(
  qrPngDataUrl: string,
  logo: { dataUrl: string; sizeRatio: number },
  size: number
): Promise<string> {
  const qrImg = await loadImage(qrPngDataUrl);
  const logoImg = await loadImage(logo.dataUrl);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrPngDataUrl;
  ctx.drawImage(qrImg, 0, 0, size, size);
  const logoSize = size * Math.min(Math.max(logo.sizeRatio, 0.1), 0.35);
  const offset = (size - logoSize) / 2;
  // White backing plate so the logo stays scannable against dark QR modules.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(offset - 4, offset - 4, logoSize + 8, logoSize + 8);
  ctx.drawImage(logoImg, offset, offset, logoSize, logoSize);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(blob);
}

function loadImage(dataUrl: string): Promise<ImageBitmap> {
  return fetch(dataUrl)
    .then((r) => r.blob())
    .then((b) => createImageBitmap(b));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
