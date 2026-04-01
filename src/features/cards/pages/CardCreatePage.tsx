import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCard, previewCard, getCardTemplates } from "../api";

// Allow regular URLs, data URLs (file uploads), and blob URLs
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

const cardCreateSchema = z.object({
  templateId: z.string().min(1, "Please select a template."),
  title: z.string().min(1, "Title is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  flavorText: z.string().min(1, "Flavor text is required."),
  backgroundImage: imageFieldSchema,
  foregroundImage: imageFieldSchema,
});

type CardCreateValues = z.infer<typeof cardCreateSchema>;

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
  if (!value) return {};

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

  return (
    <div className="image-input-group">
      <div className="image-input-label-row">
        <span className="image-input-label">{label}</span>
        <span className="image-current-file">
          Current: {currentDisplayName}
        </span>
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
          onClick={onClear}
          disabled={!value}
        >
          Clear Image
        </button>
      </div>

      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}

export default function CardCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: getCardTemplates,
  });

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<CardCreateValues>({
    resolver: zodResolver(cardCreateSchema),
    defaultValues: {
      templateId: "",
      title: "",
      subtitle: "",
      flavorText: "",
      backgroundImage: "",
      foregroundImage: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (templates && templates.length > 0) {
      const current = getValues("templateId");
      if (!current) {
        setValue("templateId", templates[0].id, { shouldValidate: true });
      }
    }
  }, [templates, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: createCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/dashboard");
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewCard,
    onSuccess: (imageBlob) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(imageBlob));
    },
  });

  async function triggerPreview() {
    const valid = await trigger([
      "templateId",
      "title",
      "subtitle",
      "flavorText",
    ]);

    if (!valid) {
      return;
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
      flavorText: values.flavorText,
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
  const canRunActions =
    selectedTemplateId.trim().length > 0 &&
    titleValue.trim().length > 0 &&
    subtitleValue.trim().length > 0 &&
    flavorTextValue.trim().length > 0;

  return (
    <div className="page-stack">
      {/* Hero */}
      <section className="content-hero">
        <div>
          <p className="section-kicker">Create</p>
          <h1>Build a new profile card</h1>
          <p className="content-hero-copy">
            Fill in your card details on the left, then preview the design
            before you publish.
          </p>
        </div>
      </section>

      {/* Draft plan notice */}
      <div className="create-basic-notice">
        <span className="create-basic-icon">ℹ</span>
        <span>
          New cards start on the <strong>Draft plan</strong>. You can upgrade
          any card to Premium from your dashboard after it&apos;s been created.
        </span>
      </div>

      {/* Side-by-side layout */}
      <div className="create-layout">
        {/* Left: form */}
        <section className="content-card create-form-panel">
          <div className="content-card-header">
            <h2>Card details</h2>
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

              mutation.mutate({
                templateId: values.templateId,
                title: values.title,
                subtitle: values.subtitle,
                flavorText: values.flavorText,
                ...backgroundImagePayload,
                ...foregroundImagePayload,
              });
            })}
          >
            {/* Template */}
            <label>
              <span className="label-required">
                Template <span className="required-asterisk">*</span>
              </span>
              <select {...register("templateId")} disabled={templatesLoading}>
                <option value="">
                  {templatesLoading
                    ? "Loading templates…"
                    : "Select a template"}
                </option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors.templateId ? (
                <small className="field-error">
                  {errors.templateId.message}
                </small>
              ) : null}
            </label>

            {/* Title */}
            <label>
              <span className="label-required">
                Title <span className="required-asterisk">*</span>
              </span>
              <input {...register("title")} />
              {errors.title ? (
                <small className="field-error">{errors.title.message}</small>
              ) : null}
            </label>

            {/* Subtitle */}
            <label>
              <span className="label-required">
                Subtitle <span className="required-asterisk">*</span>
              </span>
              <input {...register("subtitle")} />
              {errors.subtitle ? (
                <small className="field-error">{errors.subtitle.message}</small>
              ) : null}
            </label>

            {/* Flavor Text */}
            <label>
              <span className="label-required">
                Flavor Text <span className="required-asterisk">*</span>
              </span>
              <textarea rows={4} {...register("flavorText")} />
              {errors.flavorText ? (
                <small className="field-error">
                  {errors.flavorText.message}
                </small>
              ) : null}
            </label>

            {/* Background Image */}
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

            {/* Foreground Image */}
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

            {mutation.isError ? (
              <div className="alert-error">
                Failed to create card. Please try again.
              </div>
            ) : null}

            <div className="button-row">
              <button
                type="submit"
                disabled={mutation.isPending || !canRunActions}
              >
                {mutation.isPending ? "Creating…" : "✦ Create Card"}
              </button>
            </div>
          </form>
        </section>

        {/* Right: preview */}
        <aside className="create-preview-panel">
          <div className="create-preview-header">
            <h3>Preview</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={triggerPreview}
              disabled={previewMutation.isPending || !canRunActions}
            >
              {previewMutation.isPending ? "Rendering…" : "↻ Refresh"}
            </button>
          </div>

          {previewMutation.isError ? (
            <p className="alert-error" style={{ margin: "12px 0 0" }}>
              Preview failed. Check your template and fields.
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
                The red dotted lines indicate where the card will be cut during
                manufacturing.
              </p>
            </>
          ) : (
            <div className="create-preview-placeholder">
              <span className="create-preview-placeholder-icon">🃏</span>
              <p>Fill in the form and click Refresh to see your card.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
