"use client";

import { useEffect, useState, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import maleAgentAnimation from "../../assets/Male-Agent.json";

export function AnimatedAiBot({
  size = 160,
  isTyping = false,
  mood = "normal" as "normal" | "thinking" | "speaking" | "greeting",
}: {
  size?: number;
  isTyping?: boolean;
  mood?: "normal" | "thinking" | "speaking" | "greeting";
}) {
  const [isActive, setIsActive] = useState(false);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const activateBot = setTimeout(() => setIsActive(true), 500);
    return () => clearTimeout(activateBot);
  }, []);

  // Control Lottie animation based on mood/state
  useEffect(() => {
    if (!lottieRef.current) return;

    switch (mood) {
      case "thinking":
        // Loop blinking/thinking animation (frames 45-86)
        lottieRef.current.playSegments([45, 86], true);
        break;
      case "speaking":
        // Loop mouth movement animation (frames 48-94)
        lottieRef.current.playSegments([48, 94], true);
        break;
      case "greeting":
        // Play full animation once then return to normal
        lottieRef.current.playSegments([0, 120], false);
        break;
      default:
        // Normal idle state with occasional blinks
        lottieRef.current.playSegments([0, 120], true);
    }
  }, [mood]);

  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Subtle background glow for the Lottie animation */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-accent/5 via-transparent to-accent/5 transition-all duration-1000 ${
            isActive ? "scale-100 opacity-100" : "scale-95 opacity-50"
          }`}
        />

        {/* Processing indicator when typing */}
        {isTyping && (
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-accent rounded-full motion-safe:animate-bounce motion-reduce:animate-none"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Lottie Animation */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
            isActive ? "scale-100 opacity-100" : "scale-95 opacity-50"
          }`}
        >
          <Lottie
            animationData={maleAgentAnimation}
            loop={!isTyping} // Don't loop when typing to control segments
            autoplay={true}
            style={{ 
              width: size * 1.8, 
              height: size * 1.8,
              transform: "scale(1.5)" // Scale to completely fill the circular boundary
            }}
            lottieRef={lottieRef}
            className="drop-shadow-lg"
          />
        </div>

        {/* Mood indicator ring */}
        <div
          className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${
            mood === "thinking"
              ? "border-blue-400/30 motion-safe:animate-pulse"
              : mood === "speaking"
                ? "border-green-400/30 motion-safe:animate-pulse"
                : "border-accent/20"
          }`}
        />
      </div>

      <div
        className={`text-center space-y-3 transition-all duration-1000 ${
          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="relative">
          <h2 className="text-2xl font-semibold">
            <span className="text-black">Welcome</span>{" "}
            <span className="bg-gradient-to-r from-[#00D4FF] via-[#8B5CF6] to-[#00D4FF] bg-clip-text text-transparent">
              Hidayah
            </span>
          </h2>
        </div>
        <p className="text-muted-foreground max-w-xs leading-relaxed">
          Your personal assistant at your service. Ready to help manage your
          bookings, materials and lose items.
        </p>
      </div>
    </div>
  );
}
