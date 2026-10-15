"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/modal";
import { useAuth } from "@/lib/auth-context";
import { updateProfile } from "@/app/actions/profile";
import { ProfileFields, type ProfileFieldsValue } from "@/components/profile-fields";

export function EditProfileButton({
  initialDisplayName,
  initialUsername,
  initialBio,
  initialExpertise,
  initialAvatarUrl,
  className,
}: {
  initialDisplayName: string;
  initialUsername: string;
  initialBio: string;
  initialExpertise: string[];
  initialAvatarUrl: string | null;
  className?: string;
}) {
  const t = useTranslations("editProfile");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {t("button")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("title")} widthClassName="max-w-xl">
        <EditProfileForm
          key={open ? "open" : "closed"}
          initialDisplayName={initialDisplayName}
          initialUsername={initialUsername}
          initialBio={initialBio}
          initialExpertise={initialExpertise}
          initialAvatarUrl={initialAvatarUrl}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

function EditProfileForm({
  initialDisplayName,
  initialUsername,
  initialBio,
  initialExpertise,
  initialAvatarUrl,
  onDone,
}: {
  initialDisplayName: string;
  initialUsername: string;
  initialBio: string;
  initialExpertise: string[];
  initialAvatarUrl: string | null;
  onDone: () => void;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ProfileFieldsValue>({
    displayName: initialDisplayName,
    username: initialUsername,
    bio: initialBio,
    expertise: initialExpertise,
    avatarPath: null,
    avatarPreview: initialAvatarUrl,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateProfile({
        displayName: fields.displayName,
        username: fields.username,
        bio: fields.bio,
        expertise: fields.expertise,
        avatarPath: fields.avatarPath ?? undefined,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await refreshProfile();
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <ProfileFields value={fields} onChange={setFields} disabled={isPending} />
      {error && <p className="mt-4 text-sm text-risk">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? tc("saving") : tc("save")}
        </button>
      </div>
    </form>
  );
}
