import { cn } from "@/lib/utils";

export type OrganicShapeProps = {
  variant?: "petal" | "blob" | "crystal";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  animate?: boolean;
  opacity?: number;
};

const OrganicShape = ({
  variant = "petal",
  size = "md",
  className = "",
  animate = true,
  opacity = 0.8,
}: OrganicShapeProps) => {
  const variants = {
    petal: "bg-gradient-to-br from-cyan-400 via-cyan-300 to-cyan-200",
    blob: "bg-gradient-to-br from-[#4ECDC4] via-[#45B7D1] to-[#96CEB4]",
    crystal: "bg-gradient-to-br from-cyan-500 to-cyan-300",
  };

  const sizes = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-48 h-48",
    xl: "w-64 h-64",
  };

  const animations = animate
    ? "animate-pulse hover:scale-110 transition-all duration-500"
    : "";

  const clipPaths = {
    petal:
      "polygon(40% 0%, 70% 20%, 100% 40%, 80% 70%, 60% 100%, 30% 80%, 0% 60%, 20% 30%)",
    blob: "polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)",
    crystal: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  };

  return (
    <div
      className={cn(
        variants[variant],
        sizes[size],
        animations,
        "rounded-full blur-sm absolute pointer-events-none",
        className
      )}
      style={{
        clipPath: clipPaths[variant],
        opacity,
      }}
    />
  );
};

export { OrganicShape };
