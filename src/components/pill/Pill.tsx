import React from "react";
import { cn } from "@/lib/utils";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "accent";
  size?: "sm" | "md" | "lg";
  onPillClick?: (text: string) => void;
}

export const Pill: React.FC<PillProps> = ({
  children,
  className,
  variant = "default",
  size = "md",
  onPillClick,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (onPillClick && typeof children === "string") {
      onPillClick(children);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const sizeStyles = {
    sm: "px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm md:px-4 md:py-2 md:text-base",
    md: "px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base md:px-5 md:py-2.5 md:text-lg",
    lg: "px-4 py-2 text-base sm:px-6 sm:py-3 sm:text-lg md:px-8 md:py-4 md:text-xl",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium cursor-pointer transition-all duration-200",
        "bg-white text-gray-700 border border-gray-200",
        "hover:shadow-md transform hover:-translate-y-0.5",
        "hover:border-cyan-400",
        "relative",
        sizeStyles[size],
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </span>
  );
};
