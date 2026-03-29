import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import AuthPageFrame from "../AuthPageFrame";
import { requestPasswordReset } from "../api";

const requestResetSchema = z.object({
  email: z.email("Enter a valid email."),
});

type RequestResetValues = z.infer<typeof requestResetSchema>;

export default function RequestPasswordResetPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestResetValues>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: RequestResetValues) => {
    setMessage(null);
    setError(null);

    try {
      const data = await requestPasswordReset(values);
      setMessage(data.response || "Password reset requested.");
    } catch {
      setError("Unable to request password reset.");
    }
  };

  return (
    <AuthPageFrame
      eyebrow="Need a reset?"
      title="Request a reset and get back into your profile workspace"
      description="We will send you the code you need so you can update your password without losing momentum."
    >
      <div className="auth-card-copy">
        <h2>Request password reset</h2>
        <p>We will email you an activation code to reset your password.</p>
      </div>

      <form className="stack" onSubmit={handleSubmit(onSubmit)}>
        <label>
          Email
          <input type="email" {...register("email")} />
          {errors.email ? (
            <small className="field-error">{errors.email.message}</small>
          ) : null}
        </label>

        {message ? <div className="alert-success">{message}</div> : null}
        {error ? <div className="alert-error">{error}</div> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Send Reset Code"}
        </button>
      </form>

      <p className="muted-copy">
        Have a code already? <Link to="/reset-password">Reset password</Link>
      </p>
    </AuthPageFrame>
  );
}
