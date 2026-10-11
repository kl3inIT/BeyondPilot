import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

type TalentPhotoProps = {
  name: string;
  /** The stored photo; without one the place holds the person's initials. */
  photoFileId?: string | null;
  /** What the photo shows, for a reader who cannot see it; empty where the name stands beside it. */
  alt?: string;
  /** 48, 64 and 72 pixels, and 72 growing to 96 on a profile's own page. */
  size: "xl" | "2xl" | "3xl" | "profile";
  /** The ring of a card in the directory. */
  ringed?: boolean;
};

/** A person's photo in a circle, or their initials where they have none. */
function TalentPhoto({ name, photoFileId, alt = "", size, ringed = false }: TalentPhotoProps) {
  return (
    <Avatar size={size} tone={ringed ? "talent" : "default"}>
      {photoFileId && <AvatarImage src={publicFileUrl(photoFileId)} alt={alt} />}
      <AvatarFallback variant="accent" aria-hidden="true">
        {initials(name, name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { TalentPhoto };
