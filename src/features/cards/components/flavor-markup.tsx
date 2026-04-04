import { useState } from "react";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeFlavorMarkupColor(value: string) {
  const color = value.trim();

  if (!color) {
    return "";
  }

  if (typeof window !== "undefined" && window.CSS?.supports("color", color)) {
    return color;
  }

  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
    return color;
  }

  return "";
}

export function convertFlavorMarkupToHtml(value: string) {
  const source = escapeHtml(value).replace(/\r\n?/g, "\n");

  const applyMarkup = (input: string): string => {
    let output = input;

    output = output.replace(
      /\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi,
      (_match, colorValue: string, content: string) => {
        const color = normalizeFlavorMarkupColor(colorValue);
        const parsedContent = applyMarkup(content);

        if (!color) {
          return parsedContent;
        }

        return `<span style="color: ${escapeHtml(color)};">${parsedContent}</span>`;
      },
    );

    output = output.replace(
      /\[smallcaps\]([\s\S]*?)\[\/smallcaps\]/gi,
      (_match, content: string) =>
        `<span style="font-variant: small-caps; letter-spacing: 0.04em;">${applyMarkup(content)}</span>`,
    );

    output = output.replace(
      /__([^_][\s\S]*?)__/g,
      (_match, content: string) => `<u>${applyMarkup(content)}</u>`,
    );

    output = output.replace(
      /\*\*([^*][\s\S]*?)\*\*/g,
      (_match, content: string) => `<strong>${applyMarkup(content)}</strong>`,
    );

    output = output.replace(
      /\*([^*][\s\S]*?)\*/g,
      (_match, content: string) => `<em>${applyMarkup(content)}</em>`,
    );

    return output;
  };

  return applyMarkup(source).replace(/\n/g, "<br>");
}

export function convertFlavorHtmlToMarkup(value: string) {
  if (!value.trim() || typeof document === "undefined") {
    return value;
  }

  const container = document.createElement("div");
  container.innerHTML = value;

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes)
      .map((child) => walk(child))
      .join("");

    if (tagName === "br") {
      return "\n";
    }

    if (tagName === "strong" || tagName === "b") {
      return children ? `**${children}**` : "";
    }

    if (tagName === "em" || tagName === "i") {
      return children ? `*${children}*` : "";
    }

    if (tagName === "u") {
      return children ? `__${children}__` : "";
    }

    if (tagName === "span") {
      const color = normalizeFlavorMarkupColor(element.style.color);
      const usesSmallCaps =
        element.style.fontVariant === "small-caps" ||
        element.style.fontVariantCaps === "small-caps";

      let content = children;

      if (usesSmallCaps) {
        content = `[smallcaps]${content}[/smallcaps]`;
      }

      return color ? `[color=${color}]${content}[/color]` : content;
    }

    if (tagName === "div" || tagName === "p") {
      return children ? `${children}\n` : "";
    }

    return children;
  }

  return Array.from(container.childNodes)
    .map((child) => walk(child))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getFlavorMarkupPlainText(value: string) {
  if (!value.trim()) {
    return "";
  }

  if (typeof document === "undefined") {
    return value.trim();
  }

  const container = document.createElement("div");
  container.innerHTML = convertFlavorMarkupToHtml(value);
  return (container.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

export function FlavorMarkupHelpModal({ onClose }: { onClose: () => void }) {
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const examples = [
    { id: "bold", label: "Bold", markup: "**Legendary hero**" },
    { id: "italic", label: "Italic", markup: "*Whispers in the dark*" },
    { id: "color", label: "Color", markup: "[color=#b42318]Danger[/color]" },
    { id: "newline", label: "New lines", markup: "First line\nSecond line" },
    { id: "underline", label: "Underline", markup: "__Rune-marked oath__" },
    {
      id: "smallcaps",
      label: "Small-caps",
      markup: "[smallcaps]guild master[/smallcaps]",
    },
  ] as const;

  async function copyMarkup(id: string, markup: string) {
    try {
      await navigator.clipboard.writeText(markup);
      setCopiedExample(id);
      window.setTimeout(() => {
        setCopiedExample((current) => (current === id ? null : current));
      }, 1200);
    } catch {
      // Ignore clipboard failures to avoid interrupting the modal.
    }
  }

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div
        className="qr-modal markup-help-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-modal-header">
          <h3>Flavor Text Markup</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">Supported formatting</p>
        <div className="qr-modal-body markup-help-body">
          <div className="markup-help-grid">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className="markup-help-card markup-help-card--button"
                onClick={() => copyMarkup(example.id, example.markup)}
                title={`Click to copy ${example.label.toLowerCase()} markup`}
              >
                <div className="markup-help-card-header">
                  <strong>{example.label}</strong>
                  {copiedExample === example.id ? (
                    <span className="markup-help-copied">Copied</span>
                  ) : null}
                </div>
                <pre>{example.markup}</pre>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="markup-help-card markup-help-card--wide markup-help-card--button"
            onClick={() =>
              copyMarkup(
                "combined",
                `**Champion**
*Bearer of the dawn blade*
__Sworn protector__
[smallcaps]Order of the phoenix[/smallcaps]
[color=royalblue]Arcane signature[/color]`,
              )
            }
            title="Click to copy combined markup example"
          >
            <div className="markup-help-card-header">
              <strong>Combined example</strong>
              {copiedExample === "combined" ? (
                <span className="markup-help-copied">Copied</span>
              ) : null}
            </div>
            <pre>{`**Champion**
*Bearer of the dawn blade*
__Sworn protector__
[smallcaps]Order of the phoenix[/smallcaps]
[color=royalblue]Arcane signature[/color]`}</pre>
          </button>
        </div>
        <div className="qr-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

interface FlavorMarkupInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onHelp: () => void;
}

export function FlavorMarkupInput({
  value,
  onChange,
  error,
  onHelp,
}: FlavorMarkupInputProps) {
  return (
    <div className="flavor-markup-input">
      <div className="flavor-markup-toolbar">
        <span className="flavor-markup-hint">
          Supports plain-text or markup
        </span>
        <button type="button" className="btn-secondary btn-xs" onClick={onHelp}>
          Markup Examples
        </button>
      </div>
      <textarea
        rows={7}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type flavor text with markup here..."
      />
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
