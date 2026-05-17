import privacyMarkdown from "../../documents/legal/privacy.md?raw";
import refundMarkdown from "../../documents/legal/refund.md?raw";
import subscriptionMarkdown from "../../documents/legal/subscription.md?raw";
import termsMarkdown from "../../documents/legal/terms.md?raw";
import userContentMarkdown from "../../documents/legal/usercontent.md?raw";

export type LegalDocumentId =
  | "privacy"
  | "refund"
  | "subscription"
  | "terms"
  | "usercontent";

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  markdown: string;
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    markdown: privacyMarkdown,
  },
  refund: {
    id: "refund",
    title: "Refund Policy",
    markdown: refundMarkdown,
  },
  subscription: {
    id: "subscription",
    title: "Subscription Policy",
    markdown: subscriptionMarkdown,
  },
  terms: {
    id: "terms",
    title: "Terms of Service",
    markdown: termsMarkdown,
  },
  usercontent: {
    id: "usercontent",
    title: "User Content Policy",
    markdown: userContentMarkdown,
  },
};
