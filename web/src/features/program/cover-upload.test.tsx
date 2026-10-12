import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { CoverUpload } from "./cover-upload";

/** The field as the settings form draws it: a label that names the control by its id. */
function field(props: Partial<React.ComponentProps<typeof CoverUpload>> = {}) {
  return (
    <>
      <label htmlFor="cover">Cover image</label>
      <CoverUpload id="cover" value="" onChange={vi.fn()} {...props} />
    </>
  );
}

describe("CoverUpload", () => {
  it("gives its id to the button a person sees, with its own words and the limits", () => {
    render(field());

    const button = screen.getByRole("button", { name: "Upload a cover image" });
    expect(button).toHaveAttribute("id", "cover");
    expect(button).toHaveAccessibleDescription("PNG, JPEG or WebP, up to 5 MB.");
    expect(button).toBeValid();
  });

  it("is the one stop of the field on the way through the page", async () => {
    const { user } = render(field());

    await user.tab();
    expect(screen.getByRole("button", { name: "Upload a cover image" })).toHaveFocus();

    // The file input is no second, unseen stop: the next Tab leaves the field.
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("says it is in error on the button", () => {
    render(field({ invalid: true }));

    expect(screen.getByRole("button", { name: "Upload a cover image" })).toBeInvalid();
  });

  it("gives the id to Replace once there is a cover", () => {
    render(field({ value: "4c0d5f9e-2b1a-4e3c-8d7f-6a5b4c3d2e02", invalid: true }));

    const replace = screen.getByRole("button", { name: "Replace" });
    expect(replace).toHaveAttribute("id", "cover");
    expect(replace).toBeInvalid();
  });
});
