import type { DetailTab } from "./types";

type AdminUserDetailTabsProps = {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
};

export default function AdminUserDetailTabs({
  activeTab,
  onChange,
}: AdminUserDetailTabsProps) {
  return (
    <div
      className="admin-tabs"
      role="tablist"
      aria-label="Admin user detail tabs"
    >
      <button
        type="button"
        className={`admin-tab${activeTab === "summary" ? " is-active" : ""}`}
        onClick={() => onChange("summary")}
        aria-selected={activeTab === "summary"}
      >
        Summary
      </button>
      <button
        type="button"
        className={`admin-tab${activeTab === "permissions" ? " is-active" : ""}`}
        onClick={() => onChange("permissions")}
        aria-selected={activeTab === "permissions"}
      >
        Permissions
      </button>
      <button
        type="button"
        className={`admin-tab${activeTab === "subscription" ? " is-active" : ""}`}
        onClick={() => onChange("subscription")}
        aria-selected={activeTab === "subscription"}
      >
        Subscription
      </button>
      <button
        type="button"
        className={`admin-tab${activeTab === "cards" ? " is-active" : ""}`}
        onClick={() => onChange("cards")}
        aria-selected={activeTab === "cards"}
      >
        Cards
      </button>
      <button
        type="button"
        className={`admin-tab${activeTab === "orders" ? " is-active" : ""}`}
        onClick={() => onChange("orders")}
        aria-selected={activeTab === "orders"}
      >
        Orders
      </button>
    </div>
  );
}
