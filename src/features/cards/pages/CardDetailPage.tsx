import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FieldErrors, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  type CardContactInfo,
  type CardCustomCss,
  type CardNamedUrl,
  type CardPremiumConfig,
  type CardUpdatePayload,
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
import {
  buildImagePayload,
  buildPreviewImagePayload,
  estimateUploadedImageBytes,
  ImageInput,
  MAX_TOTAL_UPLOAD_BYTES,
} from "../components/image-upload";
import { useAuth } from "../../auth/auth-context";
import MintCardModal from "../components/MintCardModal";
import {
  createIdempotencyKey,
  createTransaction,
  getCheckoutRedirectUrl,
  getPricing,
  getTransactions,
} from "../../transactions/api";

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

const premiumUrlSchema = z
  .object({
    name: z.string(),
    url: z.string(),
  })
  .superRefine((value, context) => {
    const trimmedName = value.name.trim();
    const trimmedUrl = value.url.trim();

    if (!trimmedName && !trimmedUrl) {
      return;
    }

    if (!trimmedName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Link name is required.",
      });
    }

    if (!trimmedUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Link URL is required.",
      });
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Enter a valid URL.",
      });
    }
  });

const contactInfoSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    organization: z.string(),
    jobTitle: z.string(),
    website: z.string().url("Enter a valid URL.").or(z.literal("")),
    birthday: z.string(),
    address: z.object({
      street1: z.string(),
      street2: z.string(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string(),
    }),
    homePhone: z.string(),
    cellPhone: z.string(),
    personalEmail: z.string().email("Enter a valid email.").or(z.literal("")),
    workEmail: z.string().email("Enter a valid email.").or(z.literal("")),
    socialMediaAccounts: z.array(premiumUrlSchema),
  })
  .superRefine((value, context) => {
    const seenPlatforms = new Map<string, number>();

    value.socialMediaAccounts.forEach((account, index) => {
      const normalizedName = account.name.trim().toLowerCase();
      if (!normalizedName) {
        return;
      }

      const existingIndex = seenPlatforms.get(normalizedName);
      if (existingIndex !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["socialMediaAccounts", index, "name"],
          message: "Each platform can only be added once.",
        });
        return;
      }

      seenPlatforms.set(normalizedName, index);
    });
  });

const customCssSchema = z.object({
  bannerColor: z.string(),
  bannerForeground: z.string(),
});

const premiumSchema = z.object({
  urlList: z.array(premiumUrlSchema),
});

const cardUpdateSchema = z
  .object({
    id: z.string().min(1, "Card ID is required."),
    templateId: z.string().min(1, "Please select a template."),
    title: z.string().min(1, "Title is required."),
    subtitle: z.string().min(1, "Subtitle is required."),
    flavorText: z
      .string()
      .refine(
        (value) => getFlavorMarkupPlainText(value).length > 0,
        "Flavor text is required.",
      ),
    contactInfo: contactInfoSchema,
    customCss: customCssSchema,
    premium: premiumSchema,
    backgroundImage: imageFieldSchema,
    foregroundImage: imageFieldSchema,
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

type CardUpdateValues = z.infer<typeof cardUpdateSchema>;

type CardPreviewSide = "front" | "back";
type CardDetailTab = "general" | "contact" | "premium";
type CardUpdateFieldErrors = FieldErrors<CardUpdateValues>;

const GENERAL_FIELD_LABELS: Record<string, string> = {
  templateId: "Template",
  title: "Title",
  subtitle: "Subtitle",
  flavorText: "Flavor Text",
  backgroundImage: "Background Image",
  foregroundImage: "Foreground Image",
  "customCss.bannerColor": "Banner Color",
  "customCss.bannerForeground": "Banner Text Color",
};

const CONTACT_FIELD_LABELS: Record<string, string> = {
  "contactInfo.firstName": "First Name",
  "contactInfo.lastName": "Last Name",
  "contactInfo.organization": "Organization",
  "contactInfo.jobTitle": "Job Title",
  "contactInfo.website": "Website",
  "contactInfo.birthday": "Birthday",
  "contactInfo.address.street1": "Street Address",
  "contactInfo.address.street2": "Address Line 2",
  "contactInfo.address.city": "City",
  "contactInfo.address.region": "State / Province",
  "contactInfo.address.postalCode": "Postal Code",
  "contactInfo.address.country": "Country",
  "contactInfo.homePhone": "Home Phone",
  "contactInfo.cellPhone": "Cell Phone",
  "contactInfo.personalEmail": "Personal Email",
  "contactInfo.workEmail": "Work Email",
  "contactInfo.socialMediaAccounts.name": "Social Media Platform",
  "contactInfo.socialMediaAccounts.url": "Social Media URL",
};

const PREMIUM_FIELD_LABELS: Record<string, string> = {
  "premium.urlList.name": "Custom Link Name",
  "premium.urlList.url": "Custom Link URL",
};

function formatFallbackFieldLabel(segment: string): string {
  const withSpaces = segment.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function findFirstFieldError(
  errorNode: unknown,
  path: string[] = [],
): { message: string; path: string[] } | null {
  if (!errorNode || typeof errorNode !== "object") {
    return null;
  }

  const record = errorNode as Record<string, unknown>;

  if (typeof record.message === "string" && path.length > 0) {
    return { message: record.message, path };
  }

  for (const key of Object.keys(record)) {
    if (key === "message" || key === "type" || key === "ref") {
      continue;
    }

    const nextPath = /^\d+$/.test(key) ? path : [...path, key];
    const match = findFirstFieldError(record[key], nextPath);
    if (match) {
      return match;
    }
  }

  return null;
}

function getTabErrorDetails(
  tab: CardDetailTab,
  invalidErrors: CardUpdateFieldErrors,
): { fieldLabel: string; message: string } | null {
  const scope =
    tab === "contact"
      ? invalidErrors.contactInfo
      : tab === "premium"
        ? invalidErrors.premium
        : {
            templateId: invalidErrors.templateId,
            title: invalidErrors.title,
            subtitle: invalidErrors.subtitle,
            flavorText: invalidErrors.flavorText,
            backgroundImage: invalidErrors.backgroundImage,
            foregroundImage: invalidErrors.foregroundImage,
            customCss: invalidErrors.customCss,
          };

  const firstError = findFirstFieldError(
    scope,
    tab === "general" ? [] : [tab === "contact" ? "contactInfo" : "premium"],
  );
  if (!firstError) {
    return null;
  }

  const normalizedPath = firstError.path.filter(
    (segment) => segment !== "root",
  );
  const labelMap =
    tab === "contact"
      ? CONTACT_FIELD_LABELS
      : tab === "premium"
        ? PREMIUM_FIELD_LABELS
        : GENERAL_FIELD_LABELS;
  const normalizedKey = normalizedPath.join(".");
  const pathWithoutIndexes = normalizedPath
    .filter((segment) => !/^\d+$/.test(segment))
    .join(".");
  const fieldLabel =
    labelMap[normalizedKey] ??
    labelMap[pathWithoutIndexes] ??
    formatFallbackFieldLabel(
      normalizedPath[normalizedPath.length - 1] ?? "field",
    );

  return {
    fieldLabel,
    message: firstError.message,
  };
}

function formatErrorPath(path: string[]): string {
  return path.reduce((result, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${result}[${segment}]`;
    }

    return result ? `${result}.${segment}` : segment;
  }, "");
}

function collectFieldErrors(
  errorNode: unknown,
  labelMap: Record<string, string>,
  path: string[] = [],
): Array<{ path: string; fieldLabel: string; message: string }> {
  if (!errorNode || typeof errorNode !== "object") {
    return [];
  }

  const record = errorNode as Record<string, unknown>;
  const results: Array<{ path: string; fieldLabel: string; message: string }> =
    [];

  if (typeof record.message === "string" && path.length > 0) {
    const pathWithoutIndexes = path.filter((segment) => !/^\d+$/.test(segment));
    const normalizedKey = pathWithoutIndexes.join(".");
    results.push({
      path: formatErrorPath(path),
      fieldLabel:
        labelMap[normalizedKey] ??
        formatFallbackFieldLabel(
          pathWithoutIndexes[pathWithoutIndexes.length - 1] ?? "field",
        ),
      message: record.message,
    });
    return results;
  }

  for (const key of Object.keys(record)) {
    if (key === "message" || key === "type" || key === "ref") {
      continue;
    }

    results.push(...collectFieldErrors(record[key], labelMap, [...path, key]));
  }

  return results;
}

function trimToUndefined(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeContactInfo(
  value: CardUpdateValues["contactInfo"],
): CardContactInfo | undefined {
  const nextValue: CardContactInfo = {
    firstName: trimToUndefined(value.firstName),
    lastName: trimToUndefined(value.lastName),
    organization: trimToUndefined(value.organization),
    jobTitle: trimToUndefined(value.jobTitle),
    website: trimToUndefined(value.website),
    birthday: trimToUndefined(value.birthday),
    address: normalizeContactAddress(value.address),
    homePhone: trimToUndefined(value.homePhone),
    cellPhone: trimToUndefined(value.cellPhone),
    personalEmail: trimToUndefined(value.personalEmail),
    workEmail: trimToUndefined(value.workEmail),
    socialAccounts: normalizeSocialAccounts(value.socialMediaAccounts),
  };

  const compactValue = Object.fromEntries(
    Object.entries(nextValue).filter(([, fieldValue]) => Boolean(fieldValue)),
  ) as CardContactInfo;

  return Object.keys(compactValue).length > 0 ? compactValue : undefined;
}

function normalizeCustomCss(
  value: CardUpdateValues["customCss"],
): CardCustomCss | undefined {
  const nextValue = Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [key, fieldValue.trim()]),
  ) as CardCustomCss;

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined;
}

function normalizePremiumUrls(
  value: CardUpdateValues["premium"]["urlList"],
): CardPremiumConfig | undefined {
  const nextUrlList = normalizeNamedUrls(value);

  return nextUrlList.length > 0 ? { urlList: nextUrlList } : undefined;
}

function normalizeNamedUrls<T extends CardNamedUrl>(value: T[]): T[] {
  return value
    .map(
      (item) =>
        ({
          name: item.name.trim(),
          url: item.url.trim(),
        }) as T,
    )
    .filter((item) => item.name && item.url);
}

function normalizeSocialAccounts(
  value: CardUpdateValues["contactInfo"]["socialMediaAccounts"],
): Record<string, string> | undefined {
  const nextValue = normalizeNamedUrls(value).reduce<Record<string, string>>(
    (accounts, item) => {
      accounts[item.name.toLowerCase()] = item.url;
      return accounts;
    },
    {},
  );

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeContactAddress(
  value: CardUpdateValues["contactInfo"]["address"],
): NonNullable<CardContactInfo["address"]> | undefined {
  const nextValue = {
    street1: value.street1.trim(),
    street2: value.street2.trim(),
    city: value.city.trim(),
    region: value.region.trim(),
    postalCode: value.postalCode.trim(),
    country: value.country.trim(),
  };

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined;
}

function mapSocialAccountsToNamedUrls(
  value?: CardContactInfo["socialAccounts"],
): CardNamedUrl[] {
  if (!value) {
    return [];
  }

  return Object.entries(value).map(([name, url]) => ({
    name,
    url,
  }));
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
  const { accountSubscriptionUntil, refreshAccountProfile } = useAuth();
  const { cardId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CardDetailTab>("general");
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSide, setPreviewSide] = useState<CardPreviewSide>("front");
  const [copiedId, setCopiedId] = useState<"card" | "template" | null>(null);
  const [isManualPreviewing, setIsManualPreviewing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFlavorMarkupHelp, setShowFlavorMarkupHelp] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintAcknowledgment, setMintAcknowledgment] = useState("");
  const autoPreviewedPreviewKeyRef = useRef<string | null>(null);

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
    control,
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
      id: "",
      templateId: "",
      title: "",
      subtitle: "",
      flavorText: "",
      contactInfo: {
        firstName: "",
        lastName: "",
        organization: "",
        jobTitle: "",
        website: "",
        birthday: "",
        address: {
          street1: "",
          street2: "",
          city: "",
          region: "",
          postalCode: "",
          country: "",
        },
        homePhone: "",
        cellPhone: "",
        personalEmail: "",
        workEmail: "",
        socialMediaAccounts: [],
      },
      customCss: {
        bannerColor: "",
        bannerForeground: "",
      },
      premium: {
        urlList: [],
      },
      backgroundImage: "",
      foregroundImage: "",
    },
  });

  const {
    fields: socialMediaFields,
    append: appendSocialMedia,
    remove: removeSocialMedia,
  } = useFieldArray({
    control,
    name: "contactInfo.socialMediaAccounts",
  });

  const {
    fields: premiumUrlFields,
    append: appendPremiumUrl,
    remove: removePremiumUrl,
  } = useFieldArray({
    control,
    name: "premium.urlList",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => getCard(cardId as string),
    enabled: Boolean(cardId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["card-templates"],
    queryFn: getCardTemplates,
  });

  const pricingQuery = useQuery({
    queryKey: ["pricing"],
    queryFn: getPricing,
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    reset({
      id: data.id,
      templateId: data.template_id || "",
      title: data.data.title,
      subtitle: data.data.subtitle,
      flavorText: convertFlavorHtmlToMarkup(data.data.flavorText),
      contactInfo: {
        firstName: data.data.contactInfo?.firstName || "",
        lastName: data.data.contactInfo?.lastName || "",
        organization: data.data.contactInfo?.organization || "",
        jobTitle: data.data.contactInfo?.jobTitle || "",
        website: data.data.contactInfo?.website || "",
        birthday: data.data.contactInfo?.birthday || "",
        address: {
          street1: data.data.contactInfo?.address?.street1 || "",
          street2: data.data.contactInfo?.address?.street2 || "",
          city: data.data.contactInfo?.address?.city || "",
          region: data.data.contactInfo?.address?.region || "",
          postalCode: data.data.contactInfo?.address?.postalCode || "",
          country: data.data.contactInfo?.address?.country || "",
        },
        homePhone: data.data.contactInfo?.homePhone || "",
        cellPhone: data.data.contactInfo?.cellPhone || "",
        personalEmail: data.data.contactInfo?.personalEmail || "",
        workEmail: data.data.contactInfo?.workEmail || "",
        socialMediaAccounts: mapSocialAccountsToNamedUrls(
          data.data.contactInfo?.socialAccounts,
        ),
      },
      customCss: {
        bannerColor: data.data.customCss?.bannerColor || "",
        bannerForeground: data.data.customCss?.bannerForeground || "",
      },
      premium: {
        urlList: data.data.premium?.urlList || [],
      },
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

    const previewKey = `${data.id}:${previewSide}`;

    if (autoPreviewedPreviewKeyRef.current === previewKey) {
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

    autoPreviewedPreviewKeyRef.current = previewKey;
    previewMutation.mutate({
      id: data.id,
      templateId: data.template_id,
      title: data.data.title,
      subtitle: data.data.subtitle,
      flavorText: data.data.flavorText,
      side: previewSide,
      contactInfo: data.data.contactInfo,
      customCss: data.data.customCss,
      premium: data.data.premium,
      ...backgroundImagePayload,
      ...foregroundImagePayload,
    });
  }, [data, previewSide]);

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

  const mintMutation = useMutation({
    mutationFn: (id: string) =>
      createTransaction({
        transactionType: "mint",
        idempotencyKey: createIdempotencyKey(),
        currency: "usd",
        mint: { cardId: id },
      }),
    onSuccess: async (result) => {
      const checkoutUrl = getCheckoutRedirectUrl(result);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      await refreshAccountProfile();
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

  const resolvedCardId = data?.id ?? cardId ?? "";

  function triggerPreview(isManual = true) {
    if (!data || !resolvedCardId) {
      console.warn(
        "[CardDetailPage] Preview skipped because card id is missing",
        {
          routeCardId: cardId,
          loadedCardId: data?.id,
          formCardId: getValues("id"),
        },
      );
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
      id: resolvedCardId,
      templateId: values.templateId,
      title: values.title,
      subtitle: values.subtitle,
      flavorText: convertFlavorMarkupToHtml(values.flavorText),
      side: previewSide,
      contactInfo: normalizeContactInfo(values.contactInfo),
      customCss: normalizeCustomCss(values.customCss),
      premium: normalizePremiumUrls(values.premium.urlList),
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
  const bannerColorValue = watch("customCss.bannerColor");
  const bannerForegroundValue = watch("customCss.bannerForeground");
  const totalUploadedImageBytes =
    estimateUploadedImageBytes(bgValue) + estimateUploadedImageBytes(fgValue);
  const selectedTemplateName =
    templates?.find((t) => t.id === selectedTemplateId)?.name || "Template";
  const canRunActions =
    selectedTemplateId.trim().length > 0 &&
    titleValue.trim().length > 0 &&
    subtitleValue.trim().length > 0 &&
    getFlavorMarkupPlainText(flavorTextValue).length > 0 &&
    totalUploadedImageBytes <= MAX_TOTAL_UPLOAD_BYTES;
  const isMintedCard = Boolean(data?.minted);
  const isAccountSubscribed = Boolean(
    accountSubscriptionUntil &&
    new Date(accountSubscriptionUntil).getTime() > Date.now(),
  );
  const monthlyMintAllowance = isAccountSubscribed
    ? (pricingQuery.data?.subscriptionTypes[0]?.monthlyMintLimit ?? 2)
    : 0;
  const monthlyMintTransactions = useMemo(() => {
    const now = new Date();
    const records = transactionsQuery.data ?? [];
    return records.filter((tx) => {
      if (tx.order_type !== "mint") {
        return false;
      }

      const status = (tx.status ?? "").toLowerCase();
      if (
        status === "cancelled" ||
        status === "canceled" ||
        status === "failed" ||
        status === "expired"
      ) {
        return false;
      }

      if (!tx.create_time) {
        return false;
      }

      const createdAt = new Date(tx.create_time);
      return (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth()
      );
    }).length;
  }, [transactionsQuery.data]);
  const monthlyMintsUsed = Math.min(
    monthlyMintAllowance,
    monthlyMintTransactions,
  );
  const monthlyMintsRemaining = Math.max(
    monthlyMintAllowance - monthlyMintsUsed,
    0,
  );
  const canEditCardAppearance = !isMintedCard;
  const canEditLinkedSections = true;
  const hasImmutableContentLock = isMintedCard;

  function handleInvalidSubmit(invalidErrors: typeof errors) {
    const targetTab: CardDetailTab = invalidErrors.contactInfo
      ? "contact"
      : invalidErrors.premium
        ? "premium"
        : "general";
    const sectionLabel =
      targetTab === "contact"
        ? "Contact Information"
        : targetTab === "premium"
          ? "User Hub"
          : "Card Appearance";
    const errorDetails = getTabErrorDetails(targetTab, invalidErrors);
    const generalErrors = collectFieldErrors(
      {
        templateId: invalidErrors.templateId,
        title: invalidErrors.title,
        subtitle: invalidErrors.subtitle,
        flavorText: invalidErrors.flavorText,
        backgroundImage: invalidErrors.backgroundImage,
        foregroundImage: invalidErrors.foregroundImage,
        customCss: invalidErrors.customCss,
      },
      GENERAL_FIELD_LABELS,
    );
    const contactErrors = collectFieldErrors(
      invalidErrors.contactInfo,
      CONTACT_FIELD_LABELS,
      ["contactInfo"],
    );
    const premiumErrors = collectFieldErrors(
      invalidErrors.premium,
      PREMIUM_FIELD_LABELS,
      ["premium"],
    );
    const allErrors = [
      ...generalErrors.map((entry) => ({ ...entry, tab: "general" as const })),
      ...contactErrors.map((entry) => ({ ...entry, tab: "contact" as const })),
      ...premiumErrors.map((entry) => ({ ...entry, tab: "premium" as const })),
    ];

    setActiveTab(targetTab);

    console.groupCollapsed("[CardDetailPage] Save blocked by validation");
    console.info("Active tab switched to:", targetTab);
    if (errorDetails) {
      console.info("First invalid field:", {
        section: sectionLabel,
        field: errorDetails.fieldLabel,
        message: errorDetails.message,
      });
    }
    console.table(
      allErrors.map((entry) => ({
        tab: entry.tab,
        path: entry.path,
        field: entry.fieldLabel,
        message: entry.message,
      })),
    );
    console.debug("Current form values at failed save:", getValues());
    console.debug("Resolved card id context:", {
      routeCardId: cardId,
      loadedCardId: data?.id,
      formCardId: getValues("id"),
      resolvedCardId,
    });
    console.debug("Raw react-hook-form errors:", invalidErrors);
    console.groupEnd();

    if (errorDetails) {
      setSubmitErrorMessage(
        `${sectionLabel} has an issue with ${errorDetails.fieldLabel}. ${errorDetails.message}`,
      );
      return;
    }

    if (invalidErrors.contactInfo) {
      setSubmitErrorMessage(
        "Contact Information has invalid or incomplete fields. Fix them before saving.",
      );
    } else if (invalidErrors.premium) {
      setSubmitErrorMessage(
        "Custom Links contains invalid or incomplete link details. Fix them before saving.",
      );
    } else {
      setSubmitErrorMessage(
        "Card Appearance has invalid or incomplete fields. Fix them before saving.",
      );
    }
  }

  const generalTabHasErrors = !!getTabErrorDetails("general", errors);
  const contactTabHasErrors = !!getTabErrorDetails("contact", errors);
  const premiumTabHasErrors = !!getTabErrorDetails("premium", errors);

  function triggerDelete() {
    if (!data || isMintedCard) {
      return;
    }

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
      {showMintModal && data ? (
        <MintCardModal
          cardTitle={data.data.title}
          mintPrice={pricingQuery.data?.mint ?? null}
          isSubscribed={isAccountSubscribed}
          mintDiscountPercent={
            pricingQuery.data?.subscriptionTypes[0]?.mintDiscountPercent
          }
          freeMintsRemaining={monthlyMintsRemaining}
          acknowledgment={mintAcknowledgment}
          onAcknowledgmentChange={setMintAcknowledgment}
          onManageSubscriptions={() => {
            setShowMintModal(false);
            setMintAcknowledgment("");
            navigate("/app/settings");
          }}
          onClose={() => {
            if (mintMutation.isPending) {
              return;
            }

            setShowMintModal(false);
            setMintAcknowledgment("");
          }}
          isPending={mintMutation.isPending}
          onConfirm={() => {
            if (!data) {
              return;
            }

            mintMutation.mutate(data.id, {
              onSuccess: async () => {
                setShowMintModal(false);
                setMintAcknowledgment("");
              },
            });
          }}
        />
      ) : null}
      <section className="content-hero">
        <div>
          <h1>Card detail</h1>
          <p className="content-hero-copy">
            Customize your card, add pictures, links, and contact info. When
            you're ready, share your card with the world!
          </p>
        </div>
        {isMintedCard && resolvedCardId ? (
          <Link className="btn-secondary" to={`/cardviewer/${resolvedCardId}`}>
            Open Mobile View
          </Link>
        ) : null}
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
              </div>
              <div className="detail-header-actions">
                <div
                  className={`detail-plan-strip ${isMintedCard ? "detail-plan-strip--premium" : "detail-plan-strip--draft"}`}
                >
                  <strong>{isMintedCard ? "Minted" : "Draft"}</strong>
                </div>
              </div>
            </div>

            <form
              className="stack"
              onSubmit={handleSubmit((values) => {
                setSubmitErrorMessage(null);

                if (!resolvedCardId) {
                  console.error(
                    "[CardDetailPage] Save blocked because card id is missing",
                    {
                      routeCardId: cardId,
                      loadedCardId: data?.id,
                      formCardId: values.id,
                    },
                  );
                  setSubmitErrorMessage(
                    "Card ID is missing. Reload the page and try again.",
                  );
                  return;
                }

                const contactInfo = normalizeContactInfo(values.contactInfo);
                const premium = normalizePremiumUrls(values.premium.urlList);

                console.debug("[CardDetailPage] Saving card", {
                  routeCardId: cardId,
                  loadedCardId: data?.id,
                  formCardId: values.id,
                  resolvedCardId,
                });

                const updatePayload: CardUpdatePayload = {
                  id: resolvedCardId,
                  contactInfo,
                  premium,
                };

                if (!isMintedCard) {
                  const backgroundImagePayload = buildImagePayload(
                    values.backgroundImage,
                    "background",
                  );
                  const foregroundImagePayload = buildImagePayload(
                    values.foregroundImage,
                    "foreground",
                  );

                  updatePayload.templateId = values.templateId;
                  updatePayload.title = values.title;
                  updatePayload.subtitle = values.subtitle;
                  updatePayload.flavorText = convertFlavorMarkupToHtml(
                    values.flavorText,
                  );
                  updatePayload.customCss = normalizeCustomCss(
                    values.customCss,
                  );

                  Object.assign(
                    updatePayload,
                    backgroundImagePayload,
                    foregroundImagePayload,
                  );
                }

                updateMutation.mutate(updatePayload);
              }, handleInvalidSubmit)}
            >
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <div className="detail-tabs-shell">
                  <div
                    className="detail-tabs"
                    role="tablist"
                    aria-label="Card detail sections"
                  >
                    <button
                      type="button"
                      role="tab"
                      className={`detail-tabs__button${activeTab === "general" ? " is-active" : ""}`}
                      aria-selected={activeTab === "general"}
                      aria-label={
                        generalTabHasErrors
                          ? "Card Appearance, has validation errors"
                          : undefined
                      }
                      onClick={() => setActiveTab("general")}
                    >
                      <span>Card Appearance</span>
                      {generalTabHasErrors ? (
                        <span
                          className="detail-tabs__button-badge"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`detail-tabs__button${activeTab === "contact" ? " is-active" : ""}`}
                      aria-selected={activeTab === "contact"}
                      aria-label={
                        contactTabHasErrors
                          ? "Contact Information, has validation errors"
                          : undefined
                      }
                      onClick={() => setActiveTab("contact")}
                    >
                      <span>Contact Information</span>
                      {contactTabHasErrors ? (
                        <span
                          className="detail-tabs__button-badge"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`detail-tabs__button${activeTab === "premium" ? " is-active" : ""}`}
                      aria-selected={activeTab === "premium"}
                      aria-label={
                        premiumTabHasErrors
                          ? "User Hub, has validation errors"
                          : undefined
                      }
                      onClick={() => setActiveTab("premium")}
                    >
                      <span>User Hub</span>
                      {premiumTabHasErrors ? (
                        <span
                          className="detail-tabs__button-badge"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </div>

                  {activeTab === "general" ? (
                    <div className="detail-tab-panel" role="tabpanel">
                      {isMintedCard ? (
                        <div
                          className="detail-lock-notice"
                          role="status"
                          aria-live="polite"
                        >
                          This card has been minted. Card Appearance is locked
                          and can no longer be edited.
                        </div>
                      ) : null}

                      {!isMintedCard ? (
                        <>
                          <section className="detail-config-section">
                            <div className="detail-config-section__header">
                              <h3>Card Appearance</h3>
                              <p>
                                Update the main content and styling for the
                                front of the card.
                              </p>
                            </div>

                            <div className="detail-config-grid">
                              <label className="detail-config-grid__full">
                                <span className="label-required">
                                  Template{" "}
                                  <span className="required-asterisk">*</span>
                                </span>
                                <select
                                  {...register("templateId")}
                                  disabled={
                                    templatesLoading || !canEditCardAppearance
                                  }
                                >
                                  <option value="">
                                    {templatesLoading
                                      ? "Loading templates..."
                                      : "Select a template"}
                                  </option>
                                  {templates?.map((template) => (
                                    <option
                                      key={template.id}
                                      value={template.id}
                                    >
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
                                  Title{" "}
                                  <span className="required-asterisk">*</span>
                                </span>
                                <input
                                  {...register("title")}
                                  disabled={hasImmutableContentLock}
                                />
                                {errors.title ? (
                                  <small className="field-error">
                                    {errors.title.message}
                                  </small>
                                ) : null}
                              </label>

                              <label>
                                <span className="label-required">
                                  Subtitle{" "}
                                  <span className="required-asterisk">*</span>
                                </span>
                                <input
                                  {...register("subtitle")}
                                  disabled={hasImmutableContentLock}
                                />
                                {errors.subtitle ? (
                                  <small className="field-error">
                                    {errors.subtitle.message}
                                  </small>
                                ) : null}
                              </label>

                              <label className="detail-config-grid__full">
                                <span className="label-required">
                                  Flavor Text{" "}
                                  <span className="required-asterisk">*</span>
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
                                  disabled={hasImmutableContentLock}
                                />
                              </label>
                            </div>
                          </section>

                          <section className="detail-config-section">
                            <div className="detail-config-section__header">
                              <h3>Custom Styling</h3>
                            </div>

                            <div className="detail-config-grid">
                              <label>
                                <span>Banner Color</span>
                                <div className="detail-color-input">
                                  <input
                                    type="color"
                                    value={bannerColorValue || "#336699"}
                                    onChange={(event) =>
                                      setValue(
                                        "customCss.bannerColor",
                                        event.target.value,
                                        {
                                          shouldValidate: true,
                                        },
                                      )
                                    }
                                    aria-label="Banner color"
                                    disabled={!canEditCardAppearance}
                                  />
                                  <span>{bannerColorValue || "#336699"}</span>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() =>
                                      setValue("customCss.bannerColor", "", {
                                        shouldValidate: true,
                                      })
                                    }
                                    disabled={!canEditCardAppearance}
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
                                    value={bannerForegroundValue || "#ffffff"}
                                    onChange={(event) =>
                                      setValue(
                                        "customCss.bannerForeground",
                                        event.target.value,
                                        { shouldValidate: true },
                                      )
                                    }
                                    aria-label="Banner foreground color"
                                    disabled={!canEditCardAppearance}
                                  />
                                  <span>
                                    {bannerForegroundValue || "#ffffff"}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() =>
                                      setValue(
                                        "customCss.bannerForeground",
                                        "",
                                        {
                                          shouldValidate: true,
                                        },
                                      )
                                    }
                                    disabled={!canEditCardAppearance}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </label>
                            </div>
                          </section>

                          <section className="detail-config-section">
                            <div className="detail-config-section__header">
                              <h3>Images</h3>
                              <p>
                                Upload the art assets used to render the card
                                preview.
                              </p>
                            </div>

                            <div className="image-input-row">
                              <ImageInput
                                label="Background Image"
                                value={bgValue}
                                maxUploadBytes={Math.max(
                                  0,
                                  MAX_TOTAL_UPLOAD_BYTES -
                                    estimateUploadedImageBytes(fgValue),
                                )}
                                onChange={(url) =>
                                  setValue("backgroundImage", url, {
                                    shouldValidate: true,
                                  })
                                }
                                onClear={() =>
                                  setValue("backgroundImage", "", {
                                    shouldValidate: true,
                                  })
                                }
                                error={errors.backgroundImage?.message}
                                disabled={hasImmutableContentLock}
                              />

                              <ImageInput
                                label="Logo / Icon"
                                value={fgValue}
                                maxUploadBytes={Math.max(
                                  0,
                                  MAX_TOTAL_UPLOAD_BYTES -
                                    estimateUploadedImageBytes(bgValue),
                                )}
                                onChange={(url) =>
                                  setValue("foregroundImage", url, {
                                    shouldValidate: true,
                                  })
                                }
                                onClear={() =>
                                  setValue("foregroundImage", "", {
                                    shouldValidate: true,
                                  })
                                }
                                error={errors.foregroundImage?.message}
                                disabled={hasImmutableContentLock}
                              />
                            </div>
                          </section>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === "contact" ? (
                    <div className="detail-tab-panel" role="tabpanel">
                      <section className="detail-config-section">
                        {canEditLinkedSections ? (
                          <>
                            <div className="detail-config-section__header">
                              <h3>Contact Information</h3>
                              <p>
                                Store the optional fields used to generate the
                                contact card vCard.
                              </p>
                            </div>

                            <div className="detail-contact-groups">
                              <section className="detail-contact-group">
                                <div className="detail-contact-group__header">
                                  <h4>Identity</h4>
                                  <p>
                                    Basic profile details for the contact card.
                                  </p>
                                </div>
                                <div className="detail-config-grid detail-config-grid--contact">
                                  <label>
                                    <span>First Name</span>
                                    <input
                                      placeholder="Jane"
                                      {...register("contactInfo.firstName")}
                                    />
                                  </label>

                                  <label>
                                    <span>Last Name</span>
                                    <input
                                      placeholder="Hero"
                                      {...register("contactInfo.lastName")}
                                    />
                                  </label>

                                  <label>
                                    <span>Organization</span>
                                    <input
                                      placeholder="Legendary Profiles"
                                      {...register("contactInfo.organization")}
                                    />
                                  </label>

                                  <label>
                                    <span>Job Title</span>
                                    <input
                                      placeholder="Community Manager"
                                      {...register("contactInfo.jobTitle")}
                                    />
                                  </label>

                                  <label>
                                    <span>Website</span>
                                    <input
                                      type="url"
                                      placeholder="https://legendaryprofiles.com"
                                      {...register("contactInfo.website")}
                                    />
                                    {errors.contactInfo?.website ? (
                                      <small className="field-error">
                                        {errors.contactInfo.website.message}
                                      </small>
                                    ) : null}
                                  </label>

                                  <label>
                                    <span>Birthday</span>
                                    <input
                                      type="date"
                                      {...register("contactInfo.birthday")}
                                    />
                                  </label>
                                </div>
                              </section>

                              <section className="detail-contact-group">
                                <div className="detail-contact-group__header">
                                  <h4>Address</h4>
                                  <p>Mailing details saved with the vCard.</p>
                                </div>
                                <div className="detail-config-grid detail-config-grid--contact">
                                  <label className="detail-config-grid__full">
                                    <span>Street Address 1</span>
                                    <input
                                      {...register(
                                        "contactInfo.address.street1",
                                      )}
                                    />
                                  </label>

                                  <label className="detail-config-grid__full">
                                    <span>Street Address 2</span>
                                    <input
                                      {...register(
                                        "contactInfo.address.street2",
                                      )}
                                    />
                                  </label>

                                  <label>
                                    <span>City</span>
                                    <input
                                      {...register("contactInfo.address.city")}
                                    />
                                  </label>

                                  <label>
                                    <span>State / Region</span>
                                    <input
                                      {...register(
                                        "contactInfo.address.region",
                                      )}
                                    />
                                  </label>

                                  <label>
                                    <span>Postal Code</span>
                                    <input
                                      {...register(
                                        "contactInfo.address.postalCode",
                                      )}
                                    />
                                  </label>

                                  <label>
                                    <span>Country</span>
                                    <input
                                      {...register(
                                        "contactInfo.address.country",
                                      )}
                                    />
                                  </label>
                                </div>
                              </section>

                              <section className="detail-contact-group">
                                <div className="detail-contact-group__header">
                                  <h4>Direct Contact</h4>
                                  <p>Phone numbers and email addresses.</p>
                                </div>
                                <div className="detail-config-grid detail-config-grid--contact">
                                  <label>
                                    <span>Home Phone</span>
                                    <input
                                      {...register("contactInfo.homePhone")}
                                    />
                                  </label>

                                  <label>
                                    <span>Cell Phone</span>
                                    <input
                                      {...register("contactInfo.cellPhone")}
                                    />
                                  </label>

                                  <label>
                                    <span>Personal Email</span>
                                    <input
                                      {...register("contactInfo.personalEmail")}
                                    />
                                    {errors.contactInfo?.personalEmail ? (
                                      <small className="field-error">
                                        {
                                          errors.contactInfo.personalEmail
                                            .message
                                        }
                                      </small>
                                    ) : null}
                                  </label>

                                  <label>
                                    <span>Work Email</span>
                                    <input
                                      {...register("contactInfo.workEmail")}
                                    />
                                    {errors.contactInfo?.workEmail ? (
                                      <small className="field-error">
                                        {errors.contactInfo.workEmail.message}
                                      </small>
                                    ) : null}
                                  </label>
                                </div>
                              </section>

                              <section className="detail-contact-group">
                                <div className="detail-config-section__header detail-config-section__header--row">
                                  <div>
                                    <h4>Social Media Accounts</h4>
                                    <p>Add named social links one at a time.</p>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() =>
                                      appendSocialMedia({ name: "", url: "" })
                                    }
                                  >
                                    Add Account
                                  </button>
                                </div>

                                {socialMediaFields.length > 0 ? (
                                  <div className="detail-link-list detail-link-list--nested">
                                    {socialMediaFields.map((field, index) => (
                                      <div
                                        key={field.id}
                                        className="detail-link-row"
                                      >
                                        <label>
                                          <span>Platform</span>
                                          <input
                                            placeholder="Instagram"
                                            {...register(
                                              `contactInfo.socialMediaAccounts.${index}.name`,
                                            )}
                                          />
                                          {errors.contactInfo
                                            ?.socialMediaAccounts?.[index]
                                            ?.name ? (
                                            <small className="field-error">
                                              {
                                                errors.contactInfo
                                                  .socialMediaAccounts[index]
                                                  ?.name?.message
                                              }
                                            </small>
                                          ) : null}
                                        </label>

                                        <label>
                                          <span>Profile URL</span>
                                          <input
                                            placeholder="https://instagram.com/legend"
                                            {...register(
                                              `contactInfo.socialMediaAccounts.${index}.url`,
                                            )}
                                          />
                                          {errors.contactInfo
                                            ?.socialMediaAccounts?.[index]
                                            ?.url ? (
                                            <small className="field-error">
                                              {
                                                errors.contactInfo
                                                  .socialMediaAccounts[index]
                                                  ?.url?.message
                                              }
                                            </small>
                                          ) : null}
                                        </label>

                                        <div className="detail-link-row__actions">
                                          <button
                                            type="button"
                                            className="btn-secondary btn-xs"
                                            onClick={() =>
                                              removeSocialMedia(index)
                                            }
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="detail-config-empty-state">
                                    No social accounts added yet.
                                  </div>
                                )}
                              </section>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="detail-config-section__header">
                              <h3>Contact Information</h3>
                              <p>
                                Minted cards require an active account
                                subscription before contact details can be
                                edited.
                              </p>
                            </div>

                            <div className="detail-config-empty-state">
                              Start or renew your account subscription to unlock
                              contact editing for minted cards.
                            </div>
                          </>
                        )}
                      </section>
                    </div>
                  ) : null}

                  {activeTab === "premium" ? (
                    <div className="detail-tab-panel" role="tabpanel">
                      <section className="detail-config-section">
                        {canEditLinkedSections ? (
                          <>
                            <div className="detail-config-section__header detail-config-section__header--row">
                              <div>
                                <h3>Custom Links</h3>
                                <p>
                                  Add one or more links to be displayed on your
                                  profile card when the user scans your QR code.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary btn-xs"
                                onClick={() =>
                                  appendPremiumUrl({ name: "", url: "" })
                                }
                              >
                                Add Link
                              </button>
                            </div>

                            {premiumUrlFields.length > 0 ? (
                              <div className="detail-link-list">
                                {premiumUrlFields.map((field, index) => (
                                  <div
                                    key={field.id}
                                    className="detail-link-row"
                                  >
                                    <label>
                                      <span>Link Name</span>
                                      <input
                                        placeholder="Portfolio"
                                        {...register(
                                          `premium.urlList.${index}.name`,
                                        )}
                                      />
                                      {errors.premium?.urlList?.[index]
                                        ?.name ? (
                                        <small className="field-error">
                                          {
                                            errors.premium.urlList[index]?.name
                                              ?.message
                                          }
                                        </small>
                                      ) : null}
                                    </label>

                                    <label>
                                      <span>URL</span>
                                      <input
                                        placeholder="https://example.com"
                                        {...register(
                                          `premium.urlList.${index}.url`,
                                        )}
                                      />
                                      {errors.premium?.urlList?.[index]?.url ? (
                                        <small className="field-error">
                                          {
                                            errors.premium.urlList[index]?.url
                                              ?.message
                                          }
                                        </small>
                                      ) : null}
                                    </label>

                                    <div className="detail-link-row__actions">
                                      <button
                                        type="button"
                                        className="btn-secondary btn-xs"
                                        onClick={() => removePremiumUrl(index)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="detail-config-empty-state">
                                No custom links added yet.
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="detail-config-section__header">
                              <div>
                                <h3>Custom Links</h3>
                                <p>
                                  Minted cards require an active account
                                  subscription before custom links can be
                                  edited.
                                </p>
                              </div>
                            </div>

                            <div className="detail-config-empty-state">
                              Start or renew your account subscription to manage
                              links for minted cards.
                            </div>
                          </>
                        )}
                      </section>
                    </div>
                  ) : null}
                </div>
              </fieldset>

              {updateMutation.isError ? (
                <div className="alert-error">Update failed.</div>
              ) : null}
              {submitErrorMessage ? (
                <div className="alert-error">{submitErrorMessage}</div>
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
                <div className="button-row__group button-row__group--left"></div>
                <div className="button-row__group button-row__group--right">
                  {!isMintedCard ? (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={triggerDelete}
                    >
                      Delete Card
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={updateMutation.isPending || !canRunActions}
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="create-preview-panel">
            <div className="create-preview-header">
              <h3>{previewSide === "front" ? "Card Front" : "Card Back"}</h3>
              <div className="create-preview-controls">
                <div
                  className="preview-side-toggle"
                  role="tablist"
                  aria-label="Preview side"
                >
                  <button
                    type="button"
                    className={`preview-side-toggle__button${previewSide === "front" ? " is-active" : ""}`}
                    onClick={() => setPreviewSide("front")}
                    aria-pressed={previewSide === "front"}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    className={`preview-side-toggle__button${previewSide === "back" ? " is-active" : ""}`}
                    onClick={() => setPreviewSide("back")}
                    aria-pressed={previewSide === "back"}
                  >
                    Back
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => triggerPreview(true)}
                  disabled={isManualPreviewing || !canRunActions}
                >
                  {isManualPreviewing ? "Wait..." : "Refresh"}
                </button>
              </div>
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
                {!isMintedCard ? (
                  <button
                    type="button"
                    className="btn-gold create-preview-mint-btn"
                    onClick={() => {
                      setMintAcknowledgment("");
                      setShowMintModal(true);
                    }}
                    disabled={mintMutation.isPending}
                  >
                    {mintMutation.isPending ? "Minting..." : "Mint Card"}
                  </button>
                ) : null}
                <div className="create-preview-bleed-note" role="note">
                  <center>
                    <strong>How to Interpret the Guide Lines</strong>
                  </center>
                  <span>
                    The green line marks the trim edge. This is where the card
                    will be cut during manufacturing. <br />
                    <br />
                    The red line marks the safe area. We automatically keep
                    details like text and logos within so they look their best.
                    <br />
                    <br />
                    These guides are temporary preview overlays and will not
                    appear on the final rendered or printed card.
                  </span>
                </div>
              </>
            ) : (
              <div className="create-preview-placeholder">
                <p>
                  {previewMutation.isPending
                    ? "Generating preview.  This may take a bit..."
                    : `Update fields and click Refresh to render the card ${previewSide}.`}
                </p>
              </div>
            )}
            {!previewUrl && !isMintedCard ? (
              <button
                type="button"
                className="btn-gold create-preview-mint-btn"
                onClick={() => {
                  setMintAcknowledgment("");
                  setShowMintModal(true);
                }}
                disabled={mintMutation.isPending}
              >
                {mintMutation.isPending ? "Minting..." : "Mint Card"}
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
