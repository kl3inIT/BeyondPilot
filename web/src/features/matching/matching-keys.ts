// Where the keys of the matched solutions must be left alone: the list's and the one-by-one review's.

/** Where a key is a letter being typed, not a shortcut. */
export const FIELDS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"]';

/**
 * What lies over the page while it is open: a dialog, a menu, the deck's sheet. The sheet the panel
 * itself is read in on a narrow screen is not one of them.
 */
export const OVERLAYS =
  '[role="dialog"]:not([data-panel="matching"]), [role="alertdialog"], [role="menu"], [role="listbox"]';

/** Where the arrows already move something: between tabs, between the choices of a group. */
export const ARROWED =
  '[role="tablist"], [role="radiogroup"], [role="toolbar"], [data-slot="toggle-group"]';
