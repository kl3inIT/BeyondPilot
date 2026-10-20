import { PublicFrame } from "@/components/layout/public-frame";

export default function PublicLayout({ children }: LayoutProps<"/[locale]">) {
  return <PublicFrame>{children}</PublicFrame>;
}
