// Renders the dynamic field set for the selected Smart QR content type into
// #qrTypeFields, and exposes a pure function to read the current SmartQrInput
// back out of those fields. Kept declarative (a small schema per type) so
// adding a new QR type later is additive, not a rewrite.

import type { QrContentType, SmartQrInput } from "../../types";

interface FieldSchema {
  name: string;
  label: string;
  type: "text" | "password" | "checkbox" | "datetime-local";
  placeholder?: string;
}

const SCHEMAS: Record<QrContentType, FieldSchema[]> = {
  url: [],
  text: [{ name: "text", label: "Text", type: "text", placeholder: "Anything you like" }],
  email: [{ name: "email", label: "Email address", type: "text", placeholder: "name@example.com" }],
  phone: [{ name: "phone", label: "Phone number", type: "text", placeholder: "+8801XXXXXXXXX" }],
  whatsapp: [
    { name: "phone", label: "Phone number", type: "text", placeholder: "+8801XXXXXXXXX" },
    { name: "whatsappMessage", label: "Pre-filled message", type: "text" },
  ],
  sms: [
    { name: "phone", label: "Phone number", type: "text" },
    { name: "smsMessage", label: "Message", type: "text" },
  ],
  wifi: [
    { name: "ssid", label: "Network name (SSID)", type: "text" },
    { name: "password", label: "Password", type: "password" },
    { name: "hidden", label: "Hidden network", type: "checkbox" },
  ],
  vcard: [
    { name: "firstName", label: "First name", type: "text" },
    { name: "lastName", label: "Last name", type: "text" },
    { name: "org", label: "Organization", type: "text" },
    { name: "phone", label: "Phone", type: "text" },
    { name: "email", label: "Email", type: "text" },
  ],
  event: [
    { name: "title", label: "Event title", type: "text" },
    { name: "start", label: "Starts", type: "datetime-local" },
    { name: "end", label: "Ends", type: "datetime-local" },
    { name: "location", label: "Location", type: "text" },
  ],
};

export function renderQrTypeFields(container: HTMLElement, type: QrContentType): void {
  const schema = SCHEMAS[type];
  container.innerHTML = "";
  for (const field of schema) {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.className = "field-label";
    span.textContent = field.label;
    const input = document.createElement("input");
    input.type = field.type;
    input.name = field.name;
    input.className = field.type === "checkbox" ? "" : "text-input";
    if (field.placeholder) input.placeholder = field.placeholder;
    label.append(span, input);
    container.appendChild(label);
  }
}

export function readQrTypeFields(container: HTMLElement, type: QrContentType): SmartQrInput {
  const get = (name: string) =>
    (container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "").trim();
  const checked = (name: string) =>
    container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ?? false;

  switch (type) {
    case "text":
      return { type, text: get("text") };
    case "email":
      return { type, email: get("email") };
    case "phone":
      return { type, phone: get("phone") };
    case "whatsapp":
      return { type, phone: get("phone"), whatsappMessage: get("whatsappMessage") };
    case "sms":
      return { type, phone: get("phone"), smsMessage: get("smsMessage") };
    case "wifi":
      return {
        type,
        wifi: {
          ssid: get("ssid"),
          password: get("password"),
          security: get("password") ? "WPA" : "nopass",
          hidden: checked("hidden"),
        },
      };
    case "vcard":
      return {
        type,
        vcard: {
          firstName: get("firstName"),
          lastName: get("lastName"),
          org: get("org") || undefined,
          phone: get("phone") || undefined,
          email: get("email") || undefined,
        },
      };
    case "event":
      return {
        type,
        event: {
          title: get("title"),
          start: get("start") ? new Date(get("start")).toISOString() : new Date().toISOString(),
          end: get("end") ? new Date(get("end")).toISOString() : new Date().toISOString(),
          location: get("location") || undefined,
        },
      };
    default:
      return { type: "url" };
  }
}
