import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      },
    },
    defaultVariants: { variant: "ghost" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export { buttonVariants };

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button data-slot="button" className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
