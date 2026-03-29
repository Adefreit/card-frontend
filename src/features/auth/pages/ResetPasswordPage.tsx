import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { resetPassword } from "../api";

const resetSchema = z.object({
  email: z.email("Enter a valid email."),
  activationCode: z.string().min(1, "Activation code is required."),
  password: z.string().min(8, "Use at least 8 characters."),
});

type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
      activationCode: "",
      password: "",
    },
  });

  const onSubmit = async (values: ResetValues) => {
    setMessage(null);
    setError(null);

    try {
      const data = await resetPassword(values);
      setMessage(data.response || "Password reset complete.");
    } catch {
      setError("Password reset failed. Check email, code, and password.");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Reset Password</h1>
        <p>Submit your activation code with a new password.</p>

        <form className="stack" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Email
            <input type="email" {...register("email")} />
            {errors.email ? (
              <small className="field-error">{errors.email.message}</small>
            ) : null}
          </label>

          <label>
            Activation Code
            <input {...register("activationCode")} />
            {errors.activationCode ? (
              <small className="field-error">
                {errors.activationCode.message}
              </small>
            ) : null}
          </label>

          <label>
            New Password
            <input type="password" {...register("password")} />
            {errors.password ? (
              <small className="field-error">{errors.password.message}</small>
            ) : null}
          </label>

          {message ? <div className="alert-success">{message}</div> : null}
          {error ? <div className="alert-error">{error}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="muted-copy">
          Return to <Link to="/login">sign in</Link>
        </p>
      </section>
    </main>
  );
}
