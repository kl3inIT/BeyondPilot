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
  KeyRoundIcon,
  MailIcon,
  MegaphoneIcon,
  MergeIcon,
  MessageSquareCheckIcon,
  MessageSquareDotIcon,
  MessageSquareIcon,
  MessageSquareXIcon,
  TimerIcon,
  TimerOffIcon,
  UserPlusIcon,
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
  organization_merged: MergeIcon,
  application_received: FileCheckIcon,
  reviewer_invitation: GavelIcon,
  application_outcome: ClipboardCheckIcon,
  solution_approved: BadgeCheckIcon,
  solution_sent_back: FilePenIcon,
  solution_rejected: BadgeXIcon,
  solution_taken_down: EyeOffIcon,
  solution_restored: EyeIcon,
  use_case_approved: MegaphoneIcon,
  use_case_sent_back: FilePenIcon,
  proposal_sent: FileCheckIcon,
  proposal_shortlisted: BadgeCheckIcon,
  proposal_declined: BadgeXIcon,
  matching_invitation: MegaphoneIcon,
  talent_approved: BadgeCheckIcon,
  talent_changes_requested: CircleXIcon,
  talent_removed: BadgeXIcon,
  talent_restored: BadgeCheckIcon,
  message_request: MessageSquareIcon,
  message_request_reminder: TimerIcon,
  message_request_accepted: MessageSquareCheckIcon,
  message_request_declined: MessageSquareXIcon,
  message_request_closed: TimerOffIcon,
  message_unread: MessageSquareDotIcon,
};

function isEmailKind(kind: string): kind is EmailKind {
  return kind in kindIcons;
}

/** The kinds with a line of description: those whose name does not say who receives the email or what it holds. */
const describedKinds = [
  "organization_merged",
  "application_outcome",
  "solution_rejected",
  "proposal_shortlisted",
  "proposal_declined",
  "matching_invitation",
  "message_request",
  "message_request_declined",
  "message_request_closed",
  "message_unread",
] as const satisfies readonly EmailKind[];

type DescribedKind = (typeof describedKinds)[number];

function hasKindDescription(kind: string): kind is DescribedKind {
  return describedKinds.some((described) => described === kind);
}

/** The icon of a kind; an envelope for one this version of the screen does not know. */
function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = isEmailKind(kind) ? kindIcons[kind] : MailIcon;
  return (
    <Icon aria-hidden="true" className={className ?? "size-4 shrink-0 text-muted-foreground"} />
  );
}

export { hasKindDescription, isEmailKind, KindIcon };
