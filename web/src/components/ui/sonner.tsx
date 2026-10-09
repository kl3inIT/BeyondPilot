"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: <CheckIcon className="size-5 text-success" />,
        info: <InfoIcon className="size-5 text-info" />,
        warning: <TriangleAlertIcon className="size-5 text-warning" />,
        error: <OctagonXIcon className="size-5 text-destructive" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Each kind on its pastel ground, as in the Figma toasts.
          "--success-bg": "var(--mint)",
          "--success-border": "var(--success)",
          "--success-text": "var(--mint-foreground)",
          "--info-bg": "var(--sky)",
          "--info-border": "var(--info)",
          "--info-text": "var(--sky-foreground)",
          "--warning-bg": "var(--peach)",
          "--warning-border": "var(--warning)",
          "--warning-text": "var(--peach-foreground)",
          "--error-bg": "var(--rose)",
          "--error-border": "var(--destructive)",
          "--error-text": "var(--rose-foreground)",
          // A 20px icon, 12px from the text, centred on it.
          "--toast-icon-margin-start": "0px",
          "--toast-icon-margin-end": "calc(var(--spacing) * 1.5)",
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: "cn-toast",
          icon: "size-5!",
          title: "font-semibold!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
