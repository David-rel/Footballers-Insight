import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  full?: boolean;
};

export default function Button({ variant = "primary", full, className, children, ...props }: ButtonProps) {
  const base = "rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none";
  const styles = {
    primary: "bg-gradient-to-r from-[#e3ca76] to-[#a78443] text-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_2px_rgba(227,202,118,0.25)]",
    ghost: "text-white/80 hover:text-white bg-white/5 border border-white/10",
    outline: "border border-[#e3ca76]/50 text-[#e3ca76] hover:text-white hover:border-white/50",
  }[variant];

  return (
    <button className={cn(base, styles, full && "w-full", className)} {...props}>
      {children}
    </button>
  );
}
