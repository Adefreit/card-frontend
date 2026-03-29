import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import AuthPageFrame from "../AuthPageFrame";
import { activateUser } from "../api";

const activationSchema = z.object({
  email: z.email("Enter a valid email."),
  code: z.string().min(1, "Activation code is required."),
});

type ActivationValues = z.infer<typeof activationSchema>;

export default function ActivateAccountPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivationValues>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      email: "",
      code: "",
    },
  });

  const onSubmit = async (values: ActivationValues) => {
    setMessage(null);
    setError(null);

    try {
      const data = await activateUser(values.email, values.code);
      setMessage(data.response || "Account activated.");
    } catch {
      setError("Activation failed. Confirm email and activation code.");
    }
  };

  return (
    <AuthPageFrame
      eyebrow="One more step"
      title="Activate your account and unlock your profile workspace"
      description="Use the activation code from your email to finish setup and start building your business card presence."
    >
      <div className="auth-card-copy">
        <h2>Activate account</h2>
        <p>Enter the activation code sent to your email address.</p>
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
          Activation Code
          <input {...register("code")} />
          {errors.code ? (
            <small className="field-error">{errors.code.message}</small>
          ) : null}
        </label>

        {message ? <div className="alert-success">{message}</div> : null}
        {error ? <div className="alert-error">{error}</div> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Activating..." : "Activate"}
        </button>
      </form>

      <p className="muted-copy">
        Already activated? <Link to="/login">Sign in</Link>
      </p>
    </AuthPageFrame>
  );
}
