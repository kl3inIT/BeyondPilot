import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { AddressField } from "./connect-panel";

const address = "https://beyondpilot.ai/mcp/operator";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AddressField", () => {
  it("holds the whole address in a field that wraps, under its label", () => {
    render(<AddressField address={address} label="Operators' server address" />);

    const field = screen.getByRole("textbox", { name: "Operators' server address" });
    expect(field).toHaveValue(address);
    expect(field).toHaveAttribute("readonly");
    // A textarea, which takes a second line where an input would cut the address.
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("copies the address and says so", async () => {
    const { user } = render(<AddressField address={address} label="Server address" />);
    const write = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith(address);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });
});
