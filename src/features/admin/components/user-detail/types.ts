export type DetailTab =
  | "summary"
  | "permissions"
  | "subscription"
  | "cards"
  | "orders";

export type EmailConfirmAction =
  | { type: "resend-activation"; email: string }
  | { type: "resend-password-reset"; email: string };

export type CardConfirmAction = {
  cardId: string;
  action: "mint" | "unmint";
};
