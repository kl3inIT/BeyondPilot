"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type RefObject, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { outcomeLink } from "./outcome-placeholders";

type OutcomeLinkPopoverProps = {
  /** Which message it adds to, so that its fields have their own ids. */
  id: string;
  /** The message's field: the words selected in it become the link's words. */
  textarea: RefObject<HTMLTextAreaElement | null>;
  /** The message with the link in place of the selection. */
  onAdd: (message: string) => void;
};

/**
 * Adds a link to an outcome message, so that nobody has to know how it is written: the words
 * selected in the message, or typed here, and the web address they open. The message keeps it as
 * `[words](https://…)`, which the preview and the email show as a link.
 */
function OutcomeLinkPopover({ id, textarea, onAdd }: OutcomeLinkPopoverProps) {
  const t = useTranslations("Review.release.link");
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState("");
  const [address, setAddress] = useState("");
  // Where the link goes: the selection when the popover opened, kept while focus is in the popover.
  const [range, setRange] = useState({ start: 0, end: 0 });

  function openChange(next: boolean) {
    const field = textarea.current;
    if (next && field) {
      setRange({ start: field.selectionStart, end: field.selectionEnd });
      setWords(field.value.slice(field.selectionStart, field.selectionEnd));
      setAddress("");
    }
    setOpen(next);
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const field = textarea.current;
    if (!field || address.trim() === "") {
      return;
    }
    const link = outcomeLink(words, address);
    onAdd(field.value.slice(0, range.start) + link + field.value.slice(range.end));
    setOpen(false);
    // Back to the message, after the link, once the popover has let go of the focus.
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(range.start + link.length, range.start + link.length);
    });
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger render={<TextButton size="sm" />}>
        <LinkIcon aria-hidden="true" />
        {t("add")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form className="flex flex-col gap-3" onSubmit={add}>
          <Field>
            <FieldLabel htmlFor={`${id}-link-words`}>{t("words")}</FieldLabel>
            <Input
              id={`${id}-link-words`}
              value={words}
              placeholder={t("wordsPlaceholder")}
              onChange={(event) => setWords(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-link-address`}>{t("address")}</FieldLabel>
            <Input
              id={`${id}-link-address`}
              inputMode="url"
              value={address}
              placeholder="https://"
              autoFocus
              required
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Button type="submit" size="sm" className="self-end">
            {t("submit")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export { OutcomeLinkPopover };
