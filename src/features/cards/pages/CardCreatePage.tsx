import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCard, previewCard, getCardTemplates } from "../api";
import {
  FlavorMarkupHelpModal,
  FlavorMarkupInput,
  getFlavorMarkupPlainText,
} from "../components/flavor-markup";
import {
  buildCardImagePayloads,
  buildCardPreviewImagePayloads,
  estimateUploadedImageBytes,
  ImageInput,
  MAX_TOTAL_UPLOAD_BYTES,
} from "../components/image-upload";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { RenderedCard } from "../../../components/RenderedCard";

// #region Validation
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

const cardCreateSchema = z
  .object({
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
    customCss: z.object({
      bannerColor: z.string(),
      bannerForeground: z.string(),
      backgroundImageOffsetX: z.number().optional(),
      backgroundImageOffsetY: z.number().optional(),
      backgroundImageScale: z.number().optional(),
      foregroundImageOffsetX: z.number().optional(),
      foregroundImageOffsetY: z.number().optional(),
      foregroundImageScale: z.number().optional(),
    }),
  })
  .refine(
    (value) =>
      estimateUploadedImageBytes(value.backgroundImage) +
        estimateUploadedImageBytes(value.foregroundImage) <=
      MAX_TOTAL_UPLOAD_BYTES,
    {
      message: "Uploaded images must total 3 MB or less.",
      path: ["foregroundImage"],
    },
  );

type CardCreateValues = z.infer<typeof cardCreateSchema>;

interface DraftLimitInfo {
  draftCount: number;
  draftLimit: number;
}
// #endregion

// #region Helpers
function normalizeCustomCss(value: CardCreateValues["customCss"]) {
  const bannerColor = value.bannerColor.trim();
  const bannerForeground = value.bannerForeground.trim();

  // Round numeric values to nearest tenth
  const bgTransformX =
    value.backgroundImageOffsetX !== undefined
      ? Math.round(value.backgroundImageOffsetX * 10) / 10
      : undefined;
  const bgTransformY =
    value.backgroundImageOffsetY !== undefined
      ? Math.round(value.backgroundImageOffsetY * 10) / 10
      : undefined;
  const bgTransformScale =
    value.backgroundImageScale !== undefined
      ? Math.round(value.backgroundImageScale * 10) / 10
      : undefined;
  const fgTransformX =
    value.foregroundImageOffsetX !== undefined
      ? Math.round(value.foregroundImageOffsetX * 10) / 10
      : undefined;
  const fgTransformY =
    value.foregroundImageOffsetY !== undefined
      ? Math.round(value.foregroundImageOffsetY * 10) / 10
      : undefined;
  const fgTransformScale =
    value.foregroundImageScale !== undefined
      ? Math.round(value.foregroundImageScale * 10) / 10
      : undefined;

  // Always return an object to ensure customCss is sent in requests
  return {
    bannerColor: bannerColor || undefined,
    bannerForeground: bannerForeground || undefined,
    backgroundImageOffsetX: bgTransformX,
    backgroundImageOffsetY: bgTransformY,
    backgroundImageScale: bgTransformScale,
    foregroundImageOffsetX: fgTransformX,
    foregroundImageOffsetY: fgTransformY,
    foregroundImageScale: fgTransformScale,
  };
}
// #endregion

// #region Components
function DraftLimitModal({
  info,
  onClose,
  onUpgrade,
}: {
  info: DraftLimitInfo;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
        <div className="qr-modal-header">
          <h3>Draft Limit Reached</h3>
          <button
            type="button"
            className="qr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="qr-modal-body" style={{ textAlign: "left" }}>
          <p style={{ marginTop: 0 }}>
            You have reached your draft card limit.
          </p>
          <p style={{ marginBottom: 0 }}>
            Current usage: <strong>{info.draftCount}</strong> of{" "}
            <strong>{info.draftLimit}</strong> drafts.
          </p>
        </div>
        <div className="qr-modal-footer">
          <button className="btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" type="button" onClick={onUpgrade}>
            Upgrade in Settings
          </button>
        </div>
      </div>
    </div>
  );
}
// #endregion

// #region Page
export default function CardCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFlavorMarkupHelp, setShowFlavorMarkupHelp] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const [draftLimitInfo, setDraftLimitInfo] = useState<DraftLimitInfo | null>(
    null,
  );

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: getCardTemplates,
  });

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    trigger,
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
      customCss: {
        bannerColor: "#336699",
        bannerForeground: "#FFFFFF",
        backgroundImageOffsetX: 0,
        backgroundImageOffsetY: 0,
        backgroundImageScale: 1,
        foregroundImageOffsetX: 0,
        foregroundImageOffsetY: 0,
        foregroundImageScale: 1,
      },
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
    onMutate: () => {
      setSubmitErrorMessage(null);
      setDraftLimitInfo(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/dashboard");
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === 403) {
        const responseData = error.response.data as
          | {
              response?: string;
              draftCount?: number;
              draftLimit?: number;
            }
          | undefined;
        if (responseData?.response === "DRAFT_LIMIT_REACHED") {
          setDraftLimitInfo({
            draftCount: responseData.draftCount ?? 0,
            draftLimit: responseData.draftLimit ?? 0,
          });
          return;
        }
      }

      setSubmitErrorMessage("Failed to create card. Please try again.");
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
    // Preview uses the same optimized image pipeline for both slots.
    const previewImagePayload = await buildCardPreviewImagePayloads({
      backgroundImage: values.backgroundImage,
      foregroundImage: values.foregroundImage,
    });

    previewMutation.mutate({
      id: "preview",
      templateId: values.templateId,
      title: values.title,
      subtitle: values.subtitle,
      flavorText: values.flavorText,
      customCss: normalizeCustomCss(values.customCss),
      ...previewImagePayload,
    });
  }

  const formValues = useWatch({ control });
  const bgValue = formValues.backgroundImage ?? "";
  const fgValue = formValues.foregroundImage ?? "";
  const selectedTemplateId = formValues.templateId ?? "";
  const selectedTemplateName =
    templates?.find((template) => template.id === selectedTemplateId)?.name ||
    "Template";
  const titleValue = formValues.title ?? "";
  const subtitleValue = formValues.subtitle ?? "";
  const flavorTextValue = formValues.flavorText ?? "";
  const bannerColorValue = formValues.customCss?.bannerColor ?? "";
  const bannerForegroundValue = formValues.customCss?.bannerForeground ?? "";
  const bgTransformX = watch("customCss.backgroundImageOffsetX") ?? 0;
  const bgTransformY = watch("customCss.backgroundImageOffsetY") ?? 0;
  const bgTransformScale = watch("customCss.backgroundImageScale") ?? 1;
  const fgTransformX = watch("customCss.foregroundImageOffsetX") ?? 0;
  const fgTransformY = watch("customCss.foregroundImageOffsetY") ?? 0;
  const fgTransformScale = watch("customCss.foregroundImageScale") ?? 1;
  const totalUploadedImageBytes =
    estimateUploadedImageBytes(bgValue) + estimateUploadedImageBytes(fgValue);
  const canRunActions =
    selectedTemplateId.trim().length > 0 &&
    titleValue.trim().length > 0 &&
    subtitleValue.trim().length > 0 &&
    getFlavorMarkupPlainText(flavorTextValue).length > 0 &&
    totalUploadedImageBytes <= MAX_TOTAL_UPLOAD_BYTES;

  return (
    <div className="page-stack">
      {draftLimitInfo ? (
        <DraftLimitModal
          info={draftLimitInfo}
          onClose={() => setDraftLimitInfo(null)}
          onUpgrade={() => {
            setDraftLimitInfo(null);
            navigate("/app/settings");
          }}
        />
      ) : null}
      {showFlavorMarkupHelp && (
        <FlavorMarkupHelpModal onClose={() => setShowFlavorMarkupHelp(false)} />
      )}

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
          New cards start out as <strong>Drafts</strong>. Once you have
          customized the card, you can <strong>mint</strong> it from your
          dashboard.
        </span>
      </div>

      {/* Side-by-side layout */}
      <div className="create-layout">
        {/* Left: form */}
        <section className="content-card create-form-panel">
          <div className="content-card-header">
            <h2>Card Appearance</h2>
          </div>

          <form
            className="stack"
            onSubmit={handleSubmit((values) => {
              const imagePayload = buildCardImagePayloads({
                backgroundImage: values.backgroundImage,
                foregroundImage: values.foregroundImage,
              });

              mutation.mutate({
                templateId: values.templateId,
                title: values.title,
                subtitle: values.subtitle,
                flavorText: values.flavorText,
                customCss: normalizeCustomCss(values.customCss),
                ...imagePayload,
              });
            })}
          >
            <section className="detail-config-section">
              <div className="detail-config-section__header">
                <h3>Card Appearance</h3>
                <p>
                  Update the main content and styling for the front of the card.
                </p>
              </div>

              <div className="detail-config-grid">
                <label className="detail-config-grid__full">
                  <span className="label-required">
                    Template <span className="required-asterisk">*</span>
                  </span>
                  <select
                    {...register("templateId")}
                    disabled={templatesLoading}
                  >
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
                    <small className="field-error">
                      {errors.title.message}
                    </small>
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

                <label className="detail-config-grid__full">
                  <span className="label-required">
                    Flavor Text <span className="required-asterisk">*</span>
                  </span>
                  <FlavorMarkupInput
                    value={flavorTextValue}
                    onChange={(nextValue) =>
                      setValue("flavorText", nextValue, {
                        shouldValidate: true,
                      })
                    }
                    error={errors.flavorText?.message}
                    onHelp={() => setShowFlavorMarkupHelp(true)}
                  />
                </label>
              </div>
            </section>

            <section className="detail-config-section" style={{ marginTop: 8 }}>
              <div className="detail-config-section__header">
                <h3>Custom Styling</h3>
              </div>
              <div className="detail-config-grid">
                <label>
                  <span>Banner Color</span>
                  <div className="detail-color-input">
                    <input
                      type="color"
                      value={bannerColorValue}
                      onChange={(event) =>
                        setValue("customCss.bannerColor", event.target.value, {
                          shouldValidate: true,
                        })
                      }
                      aria-label="Banner color"
                    />
                    <span>{bannerColorValue}</span>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() =>
                        setValue("customCss.bannerColor", "", {
                          shouldValidate: true,
                        })
                      }
                    >
                      Clear
                    </button>
                  </div>
                </label>

                <label>
                  <span>Banner Foreground</span>
                  <div className="detail-color-input">
                    <input
                      type="color"
                      value={bannerForegroundValue}
                      onChange={(event) =>
                        setValue(
                          "customCss.bannerForeground",
                          event.target.value,
                          {
                            shouldValidate: true,
                          },
                        )
                      }
                      aria-label="Banner foreground color"
                    />
                    <span>{bannerForegroundValue}</span>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() =>
                        setValue("customCss.bannerForeground", "", {
                          shouldValidate: true,
                        })
                      }
                    >
                      Clear
                    </button>
                  </div>
                </label>
              </div>
            </section>

            <section className="detail-config-section" style={{ marginTop: 8 }}>
              <div className="detail-config-section__header">
                <h3>Images</h3>
                <p>Upload the art assets used to render the card preview.</p>
              </div>

              <div className="image-input-row">
                <ImageInput
                  label="Background"
                  value={bgValue}
                  maxUploadBytes={Math.max(
                    0,
                    MAX_TOTAL_UPLOAD_BYTES -
                      estimateUploadedImageBytes(fgValue),
                  )}
                  onChange={(url) => {
                    setValue("backgroundImage", url, { shouldValidate: true });
                    // Reset image transforms when new image is uploaded
                    if (
                      url &&
                      (url.startsWith("data:") || url.startsWith("blob:"))
                    ) {
                      setValue("customCss.backgroundImageOffsetX", 0);
                      setValue("customCss.backgroundImageOffsetY", 0);
                      setValue("customCss.backgroundImageScale", 1.0);
                    }
                  }}
                  onClear={() =>
                    setValue("backgroundImage", "", { shouldValidate: true })
                  }
                  error={errors.backgroundImage?.message}
                  targetWidth={240}
                  targetHeight={336}
                  targetText="Background Crop Area"
                  transformOffsetX={bgTransformX}
                  transformOffsetY={bgTransformY}
                  transformScale={bgTransformScale}
                  onTransformChange={(x, y, s) => {
                    setValue("customCss.backgroundImageOffsetX", x);
                    setValue("customCss.backgroundImageOffsetY", y);
                    setValue("customCss.backgroundImageScale", s);
                  }}
                />

                <ImageInput
                  label="Logo / Icon"
                  value={fgValue}
                  maxUploadBytes={Math.max(
                    0,
                    MAX_TOTAL_UPLOAD_BYTES -
                      estimateUploadedImageBytes(bgValue),
                  )}
                  onChange={(url) => {
                    setValue("foregroundImage", url, { shouldValidate: true });
                    // Reset image transforms when new image is uploaded
                    if (
                      url &&
                      (url.startsWith("data:") || url.startsWith("blob:"))
                    ) {
                      setValue("customCss.foregroundImageOffsetX", 0);
                      setValue("customCss.foregroundImageOffsetY", 0);
                      setValue("customCss.foregroundImageScale", 1.0);
                    }
                  }}
                  onClear={() =>
                    setValue("foregroundImage", "", { shouldValidate: true })
                  }
                  error={errors.foregroundImage?.message}
                  targetWidth={120}
                  targetHeight={120}
                  targetText="Logo Crop Area"
                  transformOffsetX={fgTransformX}
                  transformOffsetY={fgTransformY}
                  transformScale={fgTransformScale}
                  onTransformChange={(x, y, s) => {
                    setValue("customCss.foregroundImageOffsetX", x);
                    setValue("customCss.foregroundImageOffsetY", y);
                    setValue("customCss.foregroundImageScale", s);
                  }}
                />
              </div>
            </section>

            {submitErrorMessage ? (
              <div className="alert-error">{submitErrorMessage}</div>
            ) : null}

            <p className="legal-consent">
              By creating this card, you agree to our{" "}
              <a
                href="/legal/usercontent"
                target="_blank"
                rel="noopener noreferrer"
              >
                User Content Policy
              </a>
              .
            </p>

            <div className="button-row">
              <div className="button-row__group button-row__group--right">
                <button
                  type="submit"
                  disabled={mutation.isPending || !canRunActions}
                >
                  {mutation.isPending ? "Creating…" : "✦ Create Card"}
                </button>
              </div>
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
              {previewMutation.isPending ? "Wait…" : "↻ Refresh"}
            </button>
          </div>

          {previewMutation.isError ? (
            <p className="alert-error" style={{ margin: "12px 0 0" }}>
              Preview failed. Check your template and fields.
            </p>
          ) : null}

          {previewUrl ? (
            <>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RenderedCard
                  imageUrl={previewUrl}
                  isLoading={previewMutation.isPending}
                />
              </div>
              <p className="create-preview-bleed-note">
                The green line is where the card will be cut. The red line is
                the safe area - keep important details inside this border.
              </p>
            </>
          ) : previewMutation.isPending ? (
            <LoadingSpinner label="Generating preview..." />
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
// #endregion
