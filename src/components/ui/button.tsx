import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const styles = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      tone: {
        primary: "bg-primary text-primary-fg",
        quiet: "border border-line bg-surface text-fg",
        ghost: "bg-transparent text-fg",
      },
      size: {
        md: "min-h-11 px-4 text-base",
        lg: "min-h-12 w-full px-5 text-lg",
      },
    },
    defaultVariants: { tone: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof styles>;

export function Button({ className, tone, size, type = "button", ...props }: Props) {
  return <button type={type} className={cn(styles({ tone, size }), className)} {...props} />;
}
