import {
  BadgeCheckIcon,
  BadgeXIcon,
  CircleXIcon,
  DoorClosedIcon,
  DoorOpenIcon,
  EyeIcon,
  EyeOffIcon,
  ClipboardCheckIcon,
  FileCheckIcon,
  FilePenIcon,
  GavelIcon,
  HandshakeIcon,
  KeyRoundIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  TimerIcon,
  TimerOffIcon,
  UserPlusIcon,
  UsersIcon,
  UserXIcon,
} from "lucide-react";

import type { EmailKind } from "./email-search";

/** The icon each kind of email is shown with: plain, in the muted colour, beside its name. */
const kindIcons: Record<EmailKind, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  sign_in_code: KeyRoundIcon,
  organization_invitation: UserPlusIcon,
  organization_approved: BadgeCheckIcon,
  organization_refused: BadgeXIcon,
  organization_sent_back: FilePenIcon,
  organization_request_approved: DoorOpenIcon,
  organization_request_declined: DoorClosedIcon,
  organization_taken_down: EyeOffIcon,
  organization_restored: EyeIcon,
  application_received: FileCheckIcon,
  reviewer_invitation: GavelIcon,
  application_outcome: ClipboardCheckIcon,
  introduction_request: HandshakeIcon,
  introduction_made: UsersIcon,
  introduction_declined: UserXIcon,
  use_case_approved: MegaphoneIcon,
  use_case_sent_back: FilePenIcon,
  talent_approved: BadgeCheckIcon,
  talent_changes_requested: CircleXIcon,
  talent_removed: BadgeXIcon,
  talent_enquiry: MessageSquareIcon,
  talent_enquiry_reminder: TimerIcon,
  talent_introduction: UsersIcon,
  talent_enquiry_declined: UserXIcon,
  talent_enquiry_closed: TimerOffIcon,
};

function isEmailKind(kind: string): kind is EmailKind {
  return kind in kindIcons;
}

/** The icon of a kind; an envelope for one this version of the screen does not know. */
function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = isEmailKind(kind) ? kindIcons[kind] : MailIcon;
  return (
    <Icon aria-hidden="true" className={className ?? "size-4 shrink-0 text-muted-foreground"} />
  );
}

export { isEmailKind, KindIcon };
