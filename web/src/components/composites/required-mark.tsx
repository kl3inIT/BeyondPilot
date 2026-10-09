/** The red star after the label of a field that must be filled; screen readers hear the error instead. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  );
}

export { RequiredMark };
