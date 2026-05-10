import privacyMarkdown from "../../documents/privacy.md?raw";
import refundMarkdown from "../../documents/refund.md?raw";
import subscriptionMarkdown from "../../documents/subscription.md?raw";
import termsMarkdown from "../../documents/terms.md?raw";
import userContentMarkdown from "../../documents/usercontent.md?raw";

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
