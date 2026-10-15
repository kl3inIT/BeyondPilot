import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUnreadMessages } from "@/lib/api/generated";
import { render } from "@/test/render";

import { HeaderMessages } from "./header-messages";

vi.mock("@/lib/api/generated", () => ({ getUnreadMessages: vi.fn() }));
const unread = vi.mocked(getUnreadMessages);

function answer(count: number, requests = 0) {
  return { data: { unread: count, requests } } as Awaited<ReturnType<typeof getUnreadMessages>>;
}

describe("header messages", () => {
  beforeEach(() => {
    unread.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens Messages and hides the badge when nothing waits", async () => {
    unread.mockResolvedValue(answer(0));
    render(<HeaderMessages />);
    const link = screen.getByRole("link", { name: "Messages" });
    expect(link).toHaveAttribute("href", "/workspace/messages");
    await waitFor(() => expect(unread).toHaveBeenCalledOnce());
    expect(link).toHaveTextContent("");
  });

  it("counts incoming messages and requests, then clears after they are read", async () => {
    vi.useFakeTimers();
    unread.mockResolvedValue(answer(2, 1));
    render(<HeaderMessages />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("link", { name: "Messages, 3 wait for you" })).toHaveTextContent("3");
    unread.mockResolvedValue(answer(6, 1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole("link", { name: "Messages, 7 wait for you" })).toHaveTextContent("7");
    unread.mockResolvedValue(answer(0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole("link", { name: "Messages" })).toHaveTextContent("");
  });

  it("keeps the known count on failure and refreshes when focus returns", async () => {
    vi.useFakeTimers();
    unread.mockResolvedValue(answer(4));
    render(<HeaderMessages />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unread.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole("link", { name: "Messages, 4 wait for you" })).toHaveTextContent("4");
    vi.useRealTimers();
    unread.mockResolvedValue(answer(1));
    fireEvent.focus(window);
    expect(
      await screen.findByRole("link", { name: "Messages, 1 waits for you" }),
    ).toHaveTextContent("1");
  });

  it("says 99+ above 99, and the whole number to a screen reader", async () => {
    unread.mockResolvedValue(answer(120, 5));
    render(<HeaderMessages />);
    expect(
      await screen.findByRole("link", { name: "Messages, 125 wait for you" }),
    ).toHaveTextContent("99+");
  });

  it("skips refreshes while hidden and reads again when the tab becomes visible", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    unread.mockResolvedValue(answer(2));
    render(<HeaderMessages />);
    expect(unread).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("link", { name: "Messages, 2 wait for you" })).toHaveTextContent(
      "2",
    );
  });
});
