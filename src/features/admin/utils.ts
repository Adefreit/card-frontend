import { isAxiosError } from "axios";
import type { AdminOrderItem } from "./api";

export type ParsedIncludedEntry = {
  label: string;
  quantity: number;
};

export function formatDate(value?: string | null | Date) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

export function formatCents(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `$${(value / 100).toFixed(2)}`;
}

export function humanizeText(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ");
}

export function capitalize(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function shortId(value?: string | null) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function safeJsonStringify(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (typeof currentValue === "bigint") return currentValue.toString();

        if (typeof currentValue === "function") {
          return `[Function ${currentValue.name || "anonymous"}]`;
        }

        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        if (typeof currentValue === "object" && currentValue !== null) {
          if (seen.has(currentValue)) return "[Circular]";
          seen.add(currentValue);
        }

        return currentValue;
      },
      2,
    );
  } catch (error) {
    return JSON.stringify(
      {
        error: "Unable to serialize payload safely.",
        reason: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    );
  }
}

export function sanitizeForDisplay(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.slice(0, 2000)}... [truncated ${value.length - 2000} chars]`
      : value;
  }
  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  if (depth >= 6) return "[Max depth reached]";

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, 60)
      .map((entry) => sanitizeForDisplay(entry, depth + 1, seen));

    if (value.length > 60) {
      sanitized.push(`[${value.length - 60} more items truncated]`);
    }

    return sanitized;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record);
  const limitedEntries = entries.slice(0, 80);
  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of limitedEntries) {
    result[key] = sanitizeForDisplay(entryValue, depth + 1, seen);
  }

  if (entries.length > 80) {
    result.__truncated__ = `${entries.length - 80} more keys omitted`;
  }

  return result;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function toLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1;
}

export function parseApiError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { response?: string; message?: string; error?: string }
      | undefined;

    const apiMessage = data?.message ?? data?.response ?? data?.error;
    if (apiMessage && apiMessage.trim().length > 0) return apiMessage;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function extractIncludedEntries(
  item: AdminOrderItem,
): ParsedIncludedEntry[] {
  const itemRecord = item as Record<string, unknown>;
  const candidateContainers = [
    itemRecord.options,
    itemRecord.metadata,
    itemRecord.print_options,
  ];
  const candidateArrayKeys = [
    "cards",
    "card_ids",
    "cardIds",
    "deck_cards",
    "deckCards",
    "included_cards",
    "contents",
    "items",
  ];

  const found: ParsedIncludedEntry[] = [];

  const tryPush = (label: string | null, quantityValue: unknown) => {
    if (!label) return;
    found.push({ label, quantity: toQty(quantityValue) });
  };

  const visitArray = (entries: unknown[]) => {
    for (const entry of entries) {
      if (typeof entry === "string") {
        tryPush(toLabel(entry), 1);
        continue;
      }

      const entryRecord = asRecord(entry);
      if (!entryRecord) continue;

      const label =
        toLabel(entryRecord.title) ||
        toLabel(entryRecord.name) ||
        toLabel(entryRecord.card_name) ||
        toLabel(entryRecord.cardTitle) ||
        toLabel(entryRecord.cardId) ||
        toLabel(entryRecord.card_id) ||
        toLabel(entryRecord.product_id) ||
        toLabel(entryRecord.id);

      tryPush(
        label,
        entryRecord.quantity ?? entryRecord.qty ?? entryRecord.count,
      );
    }
  };

  for (const container of candidateContainers) {
    const containerRecord = asRecord(container);
    if (!containerRecord) continue;

    for (const key of candidateArrayKeys) {
      const value = containerRecord[key];
      if (Array.isArray(value)) visitArray(value);
    }
  }

  const deduped = new Map<string, ParsedIncludedEntry>();
  for (const entry of found) {
    const existing = deduped.get(entry.label);
    if (existing) existing.quantity += entry.quantity;
    else deduped.set(entry.label, { ...entry });
  }

  return [...deduped.values()];
}

export function getItemTitle(item: AdminOrderItem) {
  const itemRecord = item as Record<string, unknown>;
  const metadata = asRecord(itemRecord.metadata);
  const options = asRecord(itemRecord.options);

  return (
    toLabel(itemRecord.title) ||
    toLabel(metadata?.title) ||
    toLabel(metadata?.name) ||
    toLabel(options?.title) ||
    toLabel(options?.name) ||
    toLabel(itemRecord.product_id) ||
    toLabel(itemRecord.item_type) ||
    "Order Item"
  );
}
