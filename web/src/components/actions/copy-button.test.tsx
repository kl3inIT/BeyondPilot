import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { CopyButton } from "./copy-button";

const address = "https://beyondpilot.ai/mcp";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("copies the value, shows that it did and says so in a live region", async () => {
    const { user } = render(<CopyButton value={address} label="Copy" />);
    const write = vi.spyOn(navigator.clipboard, "writeText");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith(address);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("keeps both labels in the button, so its width does not change with what it says", async () => {
    const { user } = render(<CopyButton value={address} label="Copy" />);

    const button = screen.getByRole("button", { name: "Copy" });
    expect(button).toHaveTextContent("CopyCopied");
    await user.click(button);

    await waitFor(() => expect(button).toHaveAccessibleName("Copied"));
    expect(button).toHaveTextContent("CopyCopied");
  });

  it("as an icon keeps its name and says that it copied", async () => {
    const { user } = render(<CopyButton value="_dmarc" label="Copy _dmarc" appearance="icon" />);
    const write = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(screen.getByRole("button", { name: "Copy _dmarc" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied"));
    expect(write).toHaveBeenCalledWith("_dmarc");
    expect(screen.getByRole("button", { name: "Copy _dmarc" })).toBeInTheDocument();
  });

  it("tells a refused clipboard in a toast and does not say it copied", async () => {
    const { user } = render(<CopyButton value={address} label="Copy" />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new DOMException("NotAllowed"));
    const refused = vi.spyOn(toast, "error");

    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() =>
      expect(refused).toHaveBeenCalledWith(
        "The text was not copied. Select it and copy it yourself.",
      ),
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
