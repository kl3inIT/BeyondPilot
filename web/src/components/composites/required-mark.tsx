import { useTranslations } from "next-intl";

/**
 * The red star after the label of a field that must be filled. It is hidden from a screen reader:
 * the control says it with `aria-required`, which the shared form controls set for a field with
 * `requiredMark` (docs/conventions.md › Forms).
 */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

/**
 * "(required)", for a screen reader only, at the end of the label or the legend that names a group
 * of boxes or of buttons. A group cannot carry `aria-required`, which belongs to one control or to
 * a `radiogroup`, so its name says it.
 */
function RequiredWord() {
  const t = useTranslations("Form");
  return <span className="sr-only"> ({t("required")})</span>;
}

export { RequiredMark, RequiredWord };
