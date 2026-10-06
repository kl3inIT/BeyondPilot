"use client";

import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

/** A variable a kind of email offers, as the editor completes and checks it. */
type Variable = { name: string; required: boolean; sample?: string | null };

/** What the backend found wrong in the text, with the words to show for it. */
type Problem = { type: string; variable?: string | null; message: string };

/** What the screen can do to the editor from outside: put a variable where the cursor is. */
type TemplateCodeEditorHandle = { insert: (variable: string) => void };

/** A tag of the template: `{{name}}`, `{{#name}}`, `{{/name}}`, `{{^name}}`. */
const TAG = /\{\{[#/^]?\s*[\w.]+\s*\}\}/g;

/** Tags templates may not use: unescaped values, partials, delimiter changes and inheritance. */
const FORBIDDEN = /\{\{[{&>=<$]/g;

/** Every tag in the colour of a variable, so the parts that change per person stand out. */
const tags = new MatchDecorator({
  regexp: TAG,
  decoration: Decoration.mark({ class: "cm-variable" }),
});

const tagHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = tags.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = tags.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** The editor in the app's colours and type, read from its CSS variables so dark mode follows. */
const appearance = EditorView.theme({
  "&": {
    fontSize: "0.875rem",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--muted) 60%, transparent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--primary) 20%, transparent) !important",
  },
  ".cm-variable": {
    color: "var(--primary)",
    backgroundColor: "color-mix(in oklab, var(--primary) 10%, transparent)",
    borderRadius: "3px",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": {
    marginLeft: "8px",
    color: "var(--muted-foreground)",
    fontStyle: "normal",
  },
  ".cm-diagnostic": { padding: "4px 10px", fontFamily: "var(--font-sans)" },
});

/**
 * Where each problem is in the text, so it can be underlined. The backend says what is wrong but
 * not where; the tags it names are found here. A problem with no place found is still listed under
 * the field by the screen.
 */
function diagnosticsOf(text: string, problems: Problem[]): Diagnostic[] {
  const found: Diagnostic[] = [];
  const mark = (from: number, to: number, message: string) =>
    found.push({ from, to, severity: "error", message });

  for (const problem of problems) {
    if (problem.type === "unknown_variable" && problem.variable) {
      for (const match of text.matchAll(TAG)) {
        if (match[0].replace(/[{}#/^\s]/g, "") === problem.variable) {
          mark(match.index, match.index + match[0].length, problem.message);
        }
      }
    }
    if (problem.type === "syntax") {
      for (const match of text.matchAll(FORBIDDEN)) {
        mark(match.index, match.index + match[0].length, problem.message);
      }
      // An opening `{{` with no `}}` after it on the way to the next `{{`.
      for (const match of text.matchAll(/\{\{/g)) {
        const rest = text.slice(match.index + 2);
        const close = rest.indexOf("}}");
        const next = rest.indexOf("{{");
        if (close < 0 || (next >= 0 && next < close)) {
          mark(match.index, match.index + 2, problem.message);
        }
      }
    }
  }
  return found;
}

/**
 * The Markdown body of a template in a code editor: tags in colour, `{{` offers the kind's
 * variables with a sample of each, and the problems the backend found are underlined where they
 * are. One line the editor lays out for the subject is the same editor with `singleLine`.
 */
function TemplateCodeEditor({
  id,
  labelledBy,
  value,
  onChange,
  onBlur,
  variables,
  problems,
  singleLine = false,
  invalid,
  describedBy,
  ref,
}: {
  id: string;
  /** The id of the field's label, which names the editor. */
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  variables: Variable[];
  problems: Problem[];
  singleLine?: boolean;
  invalid?: boolean;
  /** The id of the text under the field that explains it or its problems. */
  describedBy?: string;
  ref?: React.Ref<TemplateCodeEditorHandle>;
}) {
  const editor = useRef<ReactCodeMirrorRef>(null);

  useImperativeHandle(ref, () => ({
    insert(variable) {
      const view = editor.current?.view;
      if (!view) {
        return;
      }
      const tag = `{{${variable}}}`;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: tag },
        selection: { anchor: from + tag.length },
        scrollIntoView: true,
      });
      view.focus();
    },
  }));

  const extensions = useMemo<Extension[]>(() => {
    const complete = (context: CompletionContext) => {
      const typed = context.matchBefore(/\{\{[#/^]?\s*[\w.]*/);
      if (!typed) {
        return null;
      }
      const prefix = typed.text.match(/^\{\{[#/^]?\s*/)?.[0] ?? "{{";
      return {
        from: typed.from,
        options: variables.map((variable) => ({
          label: `${prefix}${variable.name}}}`,
          displayLabel: variable.name,
          detail: variable.sample ?? undefined,
          type: "variable",
          boost: variable.required ? 1 : 0,
        })),
        validFor: /^\{\{[#/^]?\s*[\w.]*$/,
      };
    };
    return [
      appearance,
      tagHighlighter,
      autocompletion({ override: [complete], icons: false }),
      EditorView.contentAttributes.of({
        id,
        role: "textbox",
        "aria-labelledby": labelledBy,
        "aria-multiline": singleLine ? "false" : "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      }),
      ...(singleLine
        ? // One line: a pasted or typed line break is refused.
          [EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr))]
        : [markdown(), EditorView.lineWrapping, lintGutter()]),
    ];
  }, [variables, singleLine, id, labelledBy, describedBy, invalid]);

  // The problems arrive with the preview, after the text they concern; they are laid on it as it is.
  useEffect(() => {
    const view = editor.current?.view;
    if (view) {
      view.dispatch(setDiagnostics(view.state, diagnosticsOf(view.state.doc.toString(), problems)));
    }
  }, [problems]);

  return (
    <CodeMirror
      ref={editor}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: !singleLine,
        highlightActiveLineGutter: false,
        autocompletion: false,
        searchKeymap: false,
      }}
      data-invalid={invalid || undefined}
      className={cn(
        "rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-invalid:ring-destructive/20 dark:bg-input/30",
        !singleLine && "[&_.cm-editor]:min-h-64",
      )}
    />
  );
}

export { TemplateCodeEditor, type TemplateCodeEditorHandle };
