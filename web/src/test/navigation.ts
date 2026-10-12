import { vi } from "vitest";

/**
 * The router a component under test is given in place of Next.js's, which needs the App Router
 * around it. A test that expects a navigation or a refresh asserts on these: every one is a spy,
 * emptied after each test.
 */
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

/** What stands in for the hooks of `next/navigation`: the page is `/` in English, with no query. */
const navigation = {
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: "en" }),
};

export { navigation, router };
