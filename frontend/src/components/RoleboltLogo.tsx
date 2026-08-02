/**
 * Single source of truth for the Rolebolt logo icon.
 * Use this component everywhere — never inline logo markup directly.
 */

interface RoleboltLogoProps {
  /** sm = 28px (h-7 w-7), md = 32px (h-8 w-8), lg = 36px (h-9 w-9) */
  size?: "sm" | "md" | "lg";
  /** Extra Tailwind classes for hover effects, transitions, etc. */
  className?: string;
}

const sizeClass: Record<NonNullable<RoleboltLogoProps["size"]>, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
};

export function RoleboltLogo({ size = "md", className = "" }: RoleboltLogoProps) {
  return (
    <img
      src="/rolebolt-icon.png"
      alt="Rolebolt"
      className={[
        sizeClass[size],
        "rounded-xl object-contain shrink-0",
        "shadow-[0_2px_8px_rgba(10,102,194,0.25)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
