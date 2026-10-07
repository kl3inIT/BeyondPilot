"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, type ButtonProps } from "@/components/actions/button";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import {
  approveJoinRequest,
  declineJoinRequest,
  dismissMyOrganizationMergeNotice,
  joinOrganization,
  withdrawJoinRequest,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

/**
 * The one-click changes of the organization screens: the call, and the words that say it was made
 * when the screen itself does not show it.
 */
const actions = {
  approveRequest: {
    run: (id: string) => approveJoinRequest({ path: { id } }),
    done: "Organization.done.requestApproved",
  },
  declineRequest: {
    run: (id: string) => declineJoinRequest({ path: { id } }),
    done: "Organization.done.requestDeclined",
  },
  withdrawRequest: {
    run: () => withdrawJoinRequest(),
    done: "Organization.done.requestWithdrawn",
  },
  // Asking again after a refusal: its owners, or GenAI Fund when nobody owns it, decide once more.
  askAgain: {
    run: (id: string) => joinOrganization({ path: { id }, body: { message: null } }),
    done: "Organization.done.askedAgain",
  },
  // The notice of a merge goes away, which says enough.
  dismissMergeNotice: {
    run: () => dismissMyOrganizationMergeNotice(),
  },
} satisfies Record<string, { run: (id: string) => Promise<unknown>; done?: MessageKey }>;

type OrganizationActionProps = Pick<ButtonProps, "tone" | "prominence" | "size" | "className"> & {
  action: keyof typeof actions;
  /** The request the action is about, or the organization that is asked again. */
  id?: string;
  children: React.ReactNode;
};

/**
 * A button that makes one change to an organization and has the page read again, so the screen shows
 * what the backend now holds. A refusal is said in a toast, by its code.
 */
function OrganizationAction({ action, id = "", children, ...look }: OrganizationActionProps) {
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Set at the first press, before the pending state has rendered, so presses in one tick decide once.
  const deciding = useRef(false);

  async function act() {
    if (deciding.current) {
      return;
    }
    deciding.current = true;
    setPending(true);
    try {
      const { run, done } = actions[action] as {
        run: (id: string) => Promise<unknown>;
        done?: MessageKey;
      };
      await run(id);
      if (done) {
        notify.success(done);
      }
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      deciding.current = false;
      setPending(false);
    }
  }

  return (
    <Button {...look} pending={pending} onClick={act}>
      {children}
    </Button>
  );
}

export { OrganizationAction };
