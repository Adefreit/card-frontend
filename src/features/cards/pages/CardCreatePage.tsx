import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createCard, previewCard } from "../api";

const cardCreateSchema = z.object({
  templateId: z.uuid("Template ID must be a UUID."),
  title: z.string().min(1, "Title is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  flavorText: z.string().min(1, "Flavor text is required."),
  backgroundImageUrl: z.string().url("Must be a valid URL.").or(z.literal("")),
  foregroundImageUrl: z.string().url("Must be a valid URL.").or(z.literal("")),
});

type CardCreateValues = z.infer<typeof cardCreateSchema>;

export default function CardCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CardCreateValues>({
    resolver: zodResolver(cardCreateSchema),
    defaultValues: {
      templateId: "",
      title: "",
      subtitle: "",
      flavorText: "",
      backgroundImageUrl: "",
      foregroundImageUrl: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const mutation = useMutation({
    mutationFn: createCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/cards");
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewCard,
    onSuccess: (imageBlob) => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const nextUrl = URL.createObjectURL(imageBlob);
      setPreviewUrl(nextUrl);
    },
  });

  return (
    <section className="content-card">
      <h2>Create Card</h2>
      <form
        className="stack"
        onSubmit={handleSubmit((values) => {
          mutation.mutate({
            templateId: values.templateId,
            title: values.title,
            subtitle: values.subtitle,
            flavorText: values.flavorText,
            backgroundImageUrl: values.backgroundImageUrl || undefined,
            foregroundImageUrl: values.foregroundImageUrl || undefined,
          });
        })}
      >
        <label>
          Template ID
          <input {...register("templateId")} />
          {errors.templateId ? (
            <small className="field-error">{errors.templateId.message}</small>
          ) : null}
        </label>

        <label>
          Title
          <input {...register("title")} />
          {errors.title ? (
            <small className="field-error">{errors.title.message}</small>
          ) : null}
        </label>

        <label>
          Subtitle
          <input {...register("subtitle")} />
          {errors.subtitle ? (
            <small className="field-error">{errors.subtitle.message}</small>
          ) : null}
        </label>

        <label>
          Flavor Text
          <textarea rows={5} {...register("flavorText")} />
          {errors.flavorText ? (
            <small className="field-error">{errors.flavorText.message}</small>
          ) : null}
        </label>

        <label>
          Background Image URL
          <input
            {...register("backgroundImageUrl")}
            placeholder="https://..."
          />
          {errors.backgroundImageUrl ? (
            <small className="field-error">
              {errors.backgroundImageUrl.message}
            </small>
          ) : null}
        </label>

        <label>
          Foreground Image URL
          <input
            {...register("foregroundImageUrl")}
            placeholder="https://..."
          />
          {errors.foregroundImageUrl ? (
            <small className="field-error">
              {errors.foregroundImageUrl.message}
            </small>
          ) : null}
        </label>

        {mutation.isError ? (
          <div className="alert-error">Failed to create card.</div>
        ) : null}

        {mutation.isSuccess ? (
          <div className="alert-success">Card created.</div>
        ) : null}

        {previewMutation.isError ? (
          <div className="alert-error">Preview generation failed.</div>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const values = getValues();
              previewMutation.mutate({
                templateId: values.templateId,
                title: values.title,
                subtitle: values.subtitle,
                flavorText: values.flavorText,
                backgroundImageUrl: values.backgroundImageUrl || undefined,
                foregroundImageUrl: values.foregroundImageUrl || undefined,
              });
            }}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? "Rendering..." : "Preview"}
          </button>

          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Card"}
          </button>
        </div>
      </form>

      {previewUrl ? (
        <section className="preview-panel">
          <h3>Live Preview</h3>
          <img src={previewUrl} alt="Card preview" className="preview-image" />
        </section>
      ) : null}
    </section>
  );
}
