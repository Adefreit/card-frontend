import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { registerUser } from "../api";

const registerSchema = z
  .object({
    email: z.email("Enter a valid email."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    setMessage(null);
    setError(null);

    try {
      const data = await registerUser({
        email: values.email,
        password: values.password,
      });
      setMessage(
        data.response ||
          "Registration successful. Check email for activation code.",
      );
    } catch {
      setError("Registration failed. Check API key and backend validation.");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Create Account</h1>
        <p>Register a new account, then activate it with your email code.</p>

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

          <label>
            Confirm Password
            <input type="password" {...register("confirmPassword")} />
            {errors.confirmPassword ? (
              <small className="field-error">
                {errors.confirmPassword.message}
              </small>
            ) : null}
          </label>

          {message ? <div className="alert-success">{message}</div> : null}
          {error ? <div className="alert-error">{error}</div> : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="muted-copy">
          Already registered? <Link to="/activate">Activate account</Link>
        </p>
      </section>
    </main>
  );
}
