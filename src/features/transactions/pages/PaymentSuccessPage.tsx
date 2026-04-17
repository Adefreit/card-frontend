import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "../../auth/auth-context";

export default function PaymentSuccessPage() {
  const queryClient = useQueryClient();
  const { refreshAccountProfile } = useAuth();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["cards"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void refreshAccountProfile();
  }, [queryClient, refreshAccountProfile]);

  return (
    <div className="page-stack">
      <section className="content-hero">
        <div>
          <h1>Payment successful</h1>
          <p className="content-hero-copy">
            Your transaction has been recorded. Your dashboard will refresh with
            the latest card and subscription state.
          </p>
        </div>
        <Link className="btn-primary" to="/app/dashboard">
          Return to Dashboard
        </Link>
      </section>
    </div>
  );
}
