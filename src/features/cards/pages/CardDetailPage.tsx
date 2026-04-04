import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteCard,
  getCard,
  getCardTemplates,
  previewCard,
  updateCard,
} from "../api";
import {
  convertFlavorHtmlToMarkup,
  convertFlavorMarkupToHtml,
  FlavorMarkupHelpModal,
  FlavorMarkupInput,
  getFlavorMarkupPlainText,
} from "../components/flavor-markup";

const imageFieldSchema = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("data:") ||
      v.startsWith("blob:") ||
      /^https?:\/\/.+/.test(v),
    "Must be a valid URL or uploaded image.",
  );

const cardUpdateSchema = z.object({
  templateId: z.string().min(1, "Please select a template."),
  title: z.string().min(1, "Title is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  flavorText: z
    .string()
    .refine(
      (value) => getFlavorMarkupPlainText(value).length > 0,
      "Flavor text is required.",
    ),
  backgroundImage: imageFieldSchema,
  foregroundImage: imageFieldSchema,
});

type CardUpdateValues = z.infer<typeof cardUpdateSchema>;

interface ParsedDataUrl {
  mimeType: string;
  base64: string;
}

function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value);
  if (!match) return null;

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function buildImagePayload(value: string, prefix: "background" | "foreground") {
  if (!value) {
    return {
      [`${prefix}ImageUrl`]: "",
    };
  }

  const parsed = parseDataUrl(value);
  if (parsed) {
    return {
      [`${prefix}ImageBase64`]: parsed.base64,
      [`${prefix}ImageMimeType`]: parsed.mimeType,
    };
  }

  return {
    [`${prefix}Image`]: value,
  };
}

function buildPreviewImagePayload(
  value: string,
  prefix: "background" | "foreground",
) {
  if (!value) return {};

  const parsed = parseDataUrl(value);
  if (parsed) {
    return {
      [`${prefix}ImageBase64`]: parsed.base64,
      [`${prefix}ImageMimeType`]: parsed.mimeType,
    };
  }

  return {
    [`${prefix}ImageUrl`]: value,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ImageInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onClear: () => void;
  error?: string;
}

function getImageDisplayName(value: string): string {
  if (!value) {
    return "No file uploaded";
  }

  if (value.startsWith("data:")) {
    const parsed = parseDataUrl(value);
    if (!parsed) {
      return "Uploaded image";
    }

    const extension = parsed.mimeType.split("/")[1]?.toLowerCase() || "file";
    return `uploaded-image.${extension}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const name = url.pathname.split("/").filter(Boolean).pop();
      return name ? decodeURIComponent(name) : "remote-image";
    } catch {
      return "remote-image";
    }
  }

  return "Uploaded image";
}

function ImageInput({
  label,
  value,
  onChange,
  onClear,
  error,
}: ImageInputProps) {
  const [fileName, setFileName] = useState<string>("");
  const [copiedFileName, setCopiedFileName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(
        `Image is too large. Please upload a file smaller than ${MAX_MB} MB.`,
      );
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    const dataUrl = await readFileAsDataUrl(file);
    onChange(dataUrl);
  }

  const currentDisplayName = fileName || getImageDisplayName(value);
  const hasFile = Boolean(value);

  async function handleCopyFileName() {
    if (!hasFile) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentDisplayName);
      setCopiedFileName(true);
      window.setTimeout(() => setCopiedFileName(false), 1200);
    } catch {
      // Ignore clipboard failures to avoid interrupting form usage.
    }
  }

  function handleClear() {
    setFileName("");
    setCopiedFileName(false);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    onClear();
  }

  return (
    <div className="image-input-group">
      <div className="image-input-label-row">
        <span className="image-input-label">{label}</span>
        <button
          type="button"
          className={`image-status-chip${hasFile ? " image-status-chip--uploaded" : " image-status-chip--empty"}`}
          onClick={handleCopyFileName}
          disabled={!hasFile}
          title={
            hasFile
              ? `Click to copy file name: ${currentDisplayName}`
              : "No file uploaded"
          }
        >
          {hasFile ? (copiedFileName ? "Copied" : "File Uploaded") : "No File"}
        </button>
      </div>

      <div
        className="file-drop-zone file-drop-zone--compact"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="file-drop-hidden"
          onChange={handleFileChange}
        />
        {fileName ? (
          <span className="file-drop-name">Selected: {fileName}</span>
        ) : (
          <>
            <span className="file-drop-text">Click to upload an image</span>
            <span className="file-drop-hint">PNG, JPG, WEBP</span>
          </>
        )}
      </div>

      <div className="image-input-actions">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleClear}
          disabled={!value}
        >
          Clear Image
        </button>
      </div>

      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}

function isPremiumCard(expiresAt?: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt) > new Date();
}

function formatPremiumExpiration(expiresAt?: string | null): string {
  if (!expiresAt) {
    return "N/A";
  }

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Coming Soon</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">Upgrade Card</p>
        <div className="qr-modal-body">
          <p>
            This feature is coming soon! We're working on making it even easier
            to upgrade your cards to Premium.
          </p>
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

function DeleteConfirmModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="qr-modal-backdrop" onClick={onCancel}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Delete Card</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="qr-modal-subtitle">This action cannot be undone</p>
        <div className="qr-modal-body">
          <p>
            Are you sure you want to permanently delete this card? All of its
            data, images, and settings will be removed and cannot be recovered.
          </p>
        </div>
        <div className="qr-modal-footer">
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Yes, Delete Card"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<"card" | "template" | null>(null);
  const [isManualPreviewing, setIsManualPreviewing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFlavorMarkupHelp, setShowFlavorMarkupHelp] = useState(false);
  const autoPreviewedCardIdRef = useRef<string | null>(null);

  async function copyId(kind: "card" | "template", value?: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(kind);
      window.setTimeout(
        () => setCopiedId((prev) => (prev === kind ? null : prev)),
        1200,
      );
    } catch {
      // Ignore clipboard failures silently to avoid interrupting editing.
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CardUpdateValues>({
    resolver: zodResolver(cardUpdateSchema),
    defaultValues: {
      templateId: "",
      title: "",
      subtitle: "",
      flavorText: "",
      backgroundImage: "",
      foregroundImage: "",
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => getCard(cardId as string),
    enabled: Boolean(cardId),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: getCardTemplates,
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    reset({
      templateId: data.template_id || "",
      title: data.data.title,
      subtitle: data.data.subtitle,
      flavorText: convertFlavorHtmlToMarkup(data.data.flavorText),
      backgroundImage:
        data.data.backgroundImage || data.data.backgroundImageUrl || "",
      foregroundImage:
        data.data.foregroundImage || data.data.foregroundImageUrl || "",
    });
  }, [data, reset]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (autoPreviewedCardIdRef.current === data.id) {
      return;
    }

    const backgroundImagePayload = buildPreviewImagePayload(
      data.data.backgroundImage || data.data.backgroundImageUrl || "",
      "background",
    );
    const foregroundImagePayload = buildPreviewImagePayload(
      data.data.foregroundImage || data.data.foregroundImageUrl || "",
      "foreground",
    );

    autoPreviewedCardIdRef.current = data.id;
    previewMutation.mutate({
      templateId: data.template_id,
      title: data.data.title,
      subtitle: data.data.subtitle,
      flavorText: data.data.flavorText,
      ...backgroundImagePayload,
      ...foregroundImagePayload,
    });
  }, [data]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateMutation = useMutation({
    mutationFn: updateCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/dashboard", { replace: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/dashboard", { replace: true });
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewCard,
    onSuccess: (imageBlob) => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const nextUrl = URL.createObjectURL(imageBlob);
      setPreviewUrl(nextUrl);
    },
    onSettled: () => {
      setIsManualPreviewing(false);
    },
  });

  function triggerPreview(isManual = true) {
    if (!data) {
      return;
    }

    if (isManual) {
      setIsManualPreviewing(true);
    }

    const values = getValues();
    const backgroundImagePayload = buildPreviewImagePayload(
      values.backgroundImage,
      "background",
    );
    const foregroundImagePayload = buildPreviewImagePayload(
      values.foregroundImage,
      "foreground",
    );

    previewMutation.mutate({
      templateId: values.templateId,
      title: values.title,
      subtitle: values.subtitle,
      flavorText: convertFlavorMarkupToHtml(values.flavorText),
      ...backgroundImagePayload,
      ...foregroundImagePayload,
    });
  }

  const bgValue = watch("backgroundImage");
  const fgValue = watch("foregroundImage");
  const selectedTemplateId = watch("templateId");
  const titleValue = watch("title");
  const subtitleValue = watch("subtitle");
  const flavorTextValue = watch("flavorText");
  const selectedTemplateName =
    templates?.find((t) => t.id === selectedTemplateId)?.name || "Template";
  const canRunActions =
    selectedTemplateId.trim().length > 0 &&
    titleValue.trim().length > 0 &&
    subtitleValue.trim().length > 0 &&
    getFlavorMarkupPlainText(flavorTextValue).length > 0;
  const isPremium = data ? isPremiumCard(data.premium_expires_at) : false;
  const premiumExpiresOn = formatPremiumExpiration(data?.premium_expires_at);

  function triggerDelete() {
    if (!data) return;
    setShowDeleteModal(true);
  }

  function confirmDelete() {
    if (!data) return;
    deleteMutation.mutate(data.id);
  }

  return (
    <div className="page-stack">
      {showUpgradeModal && (
        <ComingSoonModal onClose={() => setShowUpgradeModal(false)} />
      )}
      {showDeleteModal && (
        <DeleteConfirmModal
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          isPending={deleteMutation.isPending}
        />
      )}
      {showFlavorMarkupHelp && (
        <FlavorMarkupHelpModal onClose={() => setShowFlavorMarkupHelp(false)} />
      )}

      <section className="content-hero">
        <div>
          <p className="section-kicker">Edit</p>
          <h1>Card detail</h1>
          <p className="content-hero-copy">
            Refine your profile content, regenerate previews, and keep the card
            aligned with the Legendary Profiles brand.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/dashboard">
          Back to Dashboard
        </Link>
      </section>

      {isLoading ? <p>Loading card...</p> : null}
      {isError ? <p className="alert-error">Failed to load card.</p> : null}

      {data ? (
        <div className="create-layout">
          <section className="content-card create-form-panel">
            <div className="content-card-header row-between">
              <div>
                <div className="detail-title-row">
                  <h2>{data.data.title}</h2>
                  <button
                    type="button"
                    className="meta-pill meta-pill-copy"
                    onClick={() => copyId("card", data.id)}
                    title="Copy Card ID"
                  >
                    {copiedId === "card"
                      ? "ID Copied to Clipboard"
                      : `${data.id.slice(0, 8)}`}
                  </button>
                </div>
                <p>Edit content, images, and descriptive copy for this card.</p>
              </div>
              <div className="detail-header-actions">
                <button
                  type="button"
                  className="btn-danger btn-xs"
                  onClick={triggerDelete}
                >
                  Delete Card
                </button>
              </div>
            </div>

            <form
              className="stack"
              onSubmit={handleSubmit((values) => {
                const backgroundImagePayload = buildImagePayload(
                  values.backgroundImage,
                  "background",
                );
                const foregroundImagePayload = buildImagePayload(
                  values.foregroundImage,
                  "foreground",
                );

                updateMutation.mutate({
                  id: data.id,
                  templateId: values.templateId,
                  title: values.title,
                  subtitle: values.subtitle,
                  flavorText: convertFlavorMarkupToHtml(values.flavorText),
                  ...backgroundImagePayload,
                  ...foregroundImagePayload,
                });
              })}
            >
              <div
                className={`detail-basic-banner${isPremium ? " detail-basic-banner--premium" : ""}`}
              >
                {isPremium ? (
                  <div>
                    <strong>Premium plan card</strong>
                    <p>
                      Premium features are enabled for this card. Enjoy the
                      unlocked experience.
                    </p>
                    <p>Premium Features Expire On: {premiumExpiresOn}</p>
                  </div>
                ) : (
                  <div>
                    <strong>Draft plan card</strong>
                    <p>
                      Some features are limited on Draft. Upgrade this card to
                      unlock premium features.
                    </p>
                  </div>
                )}
                {isPremium ? (
                  <button type="button" className="btn-gold" disabled>
                    Premium Active
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    Upgrade Card
                  </button>
                )}
              </div>

              <label>
                <span className="label-required">
                  Template <span className="required-asterisk">*</span>
                </span>
                <select {...register("templateId")} disabled={templatesLoading}>
                  <option value="">
                    {templatesLoading
                      ? "Loading templates..."
                      : "Select a template"}
                  </option>
                  {templates?.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {errors.templateId ? (
                  <small className="field-error">
                    {errors.templateId.message}
                  </small>
                ) : null}
                {selectedTemplateId ? (
                  <small className="id-copy-note">
                    Selected: {selectedTemplateName}
                  </small>
                ) : null}
              </label>

              <label>
                <span className="label-required">
                  Title <span className="required-asterisk">*</span>
                </span>
                <input {...register("title")} />
                {errors.title ? (
                  <small className="field-error">{errors.title.message}</small>
                ) : null}
              </label>

              <label>
                <span className="label-required">
                  Subtitle <span className="required-asterisk">*</span>
                </span>
                <input {...register("subtitle")} />
                {errors.subtitle ? (
                  <small className="field-error">
                    {errors.subtitle.message}
                  </small>
                ) : null}
              </label>

              <label>
                <span className="label-required">
                  Flavor Text <span className="required-asterisk">*</span>
                </span>
                <FlavorMarkupInput
                  value={flavorTextValue}
                  onChange={(nextValue) =>
                    setValue("flavorText", nextValue, { shouldValidate: true })
                  }
                  error={errors.flavorText?.message}
                  onHelp={() => setShowFlavorMarkupHelp(true)}
                />
              </label>

              <div className="image-input-row">
                <ImageInput
                  label="Background Image"
                  value={bgValue}
                  onChange={(url) =>
                    setValue("backgroundImage", url, { shouldValidate: true })
                  }
                  onClear={() =>
                    setValue("backgroundImage", "", { shouldValidate: true })
                  }
                  error={errors.backgroundImage?.message}
                />

                <ImageInput
                  label="Foreground Image"
                  value={fgValue}
                  onChange={(url) =>
                    setValue("foregroundImage", url, { shouldValidate: true })
                  }
                  onClear={() =>
                    setValue("foregroundImage", "", { shouldValidate: true })
                  }
                  error={errors.foregroundImage?.message}
                />
              </div>

              {updateMutation.isError ? (
                <div className="alert-error">Update failed.</div>
              ) : null}
              {updateMutation.isSuccess ? (
                <div className="alert-success">Card updated.</div>
              ) : null}
              {previewMutation.isError ? (
                <div className="alert-error">Preview generation failed.</div>
              ) : null}
              {deleteMutation.isError ? (
                <div className="alert-error">Delete failed.</div>
              ) : null}

              <div className="button-row">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || !canRunActions}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          <aside className="create-preview-panel">
            <div className="create-preview-header">
              <h3>Card Front</h3>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => triggerPreview(true)}
                disabled={isManualPreviewing || !canRunActions}
              >
                {isManualPreviewing ? "Rendering..." : "Refresh"}
              </button>
            </div>

            {previewMutation.isError ? (
              <p className="alert-error" style={{ margin: "12px 0 0" }}>
                Preview generation failed.
              </p>
            ) : null}

            {previewUrl ? (
              <>
                <img
                  src={previewUrl}
                  alt="Card preview"
                  className="create-preview-image"
                />
                <p className="create-preview-bleed-note">
                  The green line is where the card will be cut. The red line is
                  the safe area - keep important details inside this border.
                </p>
              </>
            ) : (
              <div className="create-preview-placeholder">
                <p>
                  {previewMutation.isPending
                    ? "Generating preview.  This may take a bit..."
                    : "Update fields and click Refresh to render a preview."}
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
