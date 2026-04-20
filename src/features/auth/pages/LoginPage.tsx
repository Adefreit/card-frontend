import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthPageFrame from "../AuthPageFrame";
import { useAuth } from "../auth-context";
import { authStorage } from "../../../lib/storage";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const activationSuccess =
    (location.state as { activationSuccess?: boolean } | null)
      ?.activationSuccess === true;
  const [serverError, setServerError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(() => {
    const message = authStorage.getAuthNotice();

    if (message) {
      authStorage.clearAuthNotice();
    }

    return message;
  });

  const effectiveNotice = activationSuccess
    ? "Activation successful."
    : authNotice;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    setAuthNotice(null);

    try {
      await login(values);
      const nextPath =
        (location.state as { from?: string } | null)?.from ?? "/app/dashboard";
      navigate(nextPath, { replace: true });
    } catch {
      setServerError("Login failed. Verify credentials and API key settings.");
    }
  };

  return (
    <AuthPageFrame
      eyebrow="Welcome back"
      title="Keep your profile looking legendary"
      description="Access your profiles, polish the details, and keep every card on brand."
    >
      <div className="auth-card-copy">
        <h2>Sign in</h2>
        <br />
      </div>
      <form className="stack" onSubmit={handleSubmit(onSubmit)}>
        <label>
          Email
          <input type="email" {...register("email")} />
          {errors.email ? (
            <small className="field-error">{errors.email.message}</small>
          ) : null}
        </label>

        <label>
          Password
          <input type="password" {...register("password")} />
          {errors.password ? (
            <small className="field-error">{errors.password.message}</small>
          ) : null}
        </label>

        {effectiveNotice ? (
          <div className="alert-success">{effectiveNotice}</div>
        ) : null}
        {serverError ? <div className="alert-error">{serverError}</div> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/register">Create account</Link>
        <Link to="/activate">Activate account</Link>
        <Link to="/request-password-reset">Forgot password?</Link>
      </div>
    </AuthPageFrame>
  );
}
