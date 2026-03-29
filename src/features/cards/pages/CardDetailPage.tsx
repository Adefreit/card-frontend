import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteCard, getCard, previewCard, updateCard } from "../api";

const cardUpdateSchema = z.object({
  title: z.string().min(1, "Title is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  flavorText: z.string().min(1, "Flavor text is required."),
  backgroundImageUrl: z.string().url("Must be a valid URL.").or(z.literal("")),
  foregroundImageUrl: z.string().url("Must be a valid URL.").or(z.literal("")),
});

type CardUpdateValues = z.infer<typeof cardUpdateSchema>;

export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<CardUpdateValues>({
    resolver: zodResolver(cardUpdateSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      flavorText: "",
      backgroundImageUrl: "",
      foregroundImageUrl: "",
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => getCard(cardId as string),
    enabled: Boolean(cardId),
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    reset({
      title: data.data.title,
      subtitle: data.data.subtitle,
      flavorText: data.data.flavorText,
      backgroundImageUrl: data.data.backgroundImageUrl || "",
      foregroundImageUrl: data.data.foregroundImageUrl || "",
    });
  }, [data, reset]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateMutation = useMutation({
    mutationFn: updateCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
      navigate("/app/cards", { replace: true });
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
    <div className="page-stack">
      <section className="content-hero">
        <div>
          <p className="section-kicker">Edit</p>
          <h1>Card detail</h1>
          <p className="content-hero-copy">
            Refine your profile content, regenerate previews, and keep the card
            aligned with the Legendary Profiles brand.
          </p>
        </div>
        <Link className="btn-secondary" to="/app/cards">
          Back to cards
        </Link>
      </section>

      <section className="content-card content-card-wide">
        {isLoading ? <p>Loading card...</p> : null}
        {isError ? <p className="alert-error">Failed to load card.</p> : null}

        {data ? (
          <>
            <div className="content-card-header row-between">
              <div>
                <h2>{data.data.title}</h2>
                <p>Edit content, images, and descriptive copy for this card.</p>
              </div>
              <span className="meta-pill">ID {data.id.slice(0, 8)}</span>
            </div>

            <div className="detail-meta-grid detail-meta">
              <div className="detail-meta-item">
                <span>Card ID</span>
                <strong>{data.id}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Template ID</span>
                <strong>{data.template_id || "N/A"}</strong>
              </div>
            </div>

            <form
              className="stack"
              onSubmit={handleSubmit((values) => {
                updateMutation.mutate({
                  id: data.id,
                  title: values.title,
                  subtitle: values.subtitle,
                  flavorText: values.flavorText,
                  backgroundImageUrl: values.backgroundImageUrl || undefined,
                  foregroundImageUrl: values.foregroundImageUrl || undefined,
                });
              })}
            >
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
                  <small className="field-error">
                    {errors.subtitle.message}
                  </small>
                ) : null}
              </label>

              <label>
                Flavor Text
                <textarea rows={5} {...register("flavorText")} />
                {errors.flavorText ? (
                  <small className="field-error">
                    {errors.flavorText.message}
                  </small>
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

              {updateMutation.isError ? (
                <div className="alert-error">Update failed.</div>
              ) : null}
              {updateMutation.isSuccess ? (
                <div className="alert-success">Card updated.</div>
              ) : null}
              {previewMutation.isError ? (
                <div className="alert-error">Preview generation failed.</div>
              ) : null}
              {deleteMutation.isError ? (
                <div className="alert-error">Delete failed.</div>
              ) : null}

              <div className="button-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const values = getValues();
                    previewMutation.mutate({
                      templateId: data.template_id,
                      title: values.title,
                      subtitle: values.subtitle,
                      flavorText: values.flavorText,
                      backgroundImageUrl:
                        values.backgroundImageUrl || undefined,
                      foregroundImageUrl:
                        values.foregroundImageUrl || undefined,
                    });
                  }}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? "Rendering..." : "Preview"}
                </button>

                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (!window.confirm("Delete this card permanently?")) {
                      return;
                    }

                    deleteMutation.mutate(data.id);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Card"}
                </button>
              </div>
            </form>

            {previewUrl ? (
              <section className="preview-panel">
                <h3>Live preview</h3>
                <img
                  src={previewUrl}
                  alt="Card preview"
                  className="preview-image"
                />
              </section>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
