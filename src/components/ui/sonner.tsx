import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // Reason: app uses class-based theming (.dk / .lt) with no next-themes provider;
  // observe the <html> class list so the toast theme stays in sync with the toggle.
  const [isDark, setIsDark] = React.useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dk'),
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dk'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info:    <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error:   <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg":       "var(--popover)",
          "--normal-text":     "var(--popover-foreground)",
          "--normal-border":   "var(--border)",
          "--success-bg":      "var(--toast-success-bg)",
          "--success-border":  "var(--toast-success-border)",
          "--success-text":    "var(--toast-success-text)",
          "--error-bg":        "var(--toast-error-bg)",
          "--error-border":    "var(--toast-error-border)",
          "--error-text":      "var(--toast-error-text)",
          "--warning-bg":      "var(--toast-warning-bg)",
          "--warning-border":  "var(--toast-warning-border)",
          "--warning-text":    "var(--toast-warning-text)",
          "--border-radius":   "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
