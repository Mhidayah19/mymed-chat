"use client"

import { useEffect, useState } from "react"
import { Robot } from "@phosphor-icons/react"

export function AnimatedAiBot({ size = 160 }: { size?: number }) {
  const [isActive, setIsActive] = useState(false)
  const [eyeState, setEyeState] = useState<"normal" | "blink" | "scan">("normal")

  useEffect(() => {
    const activateBot = setTimeout(() => setIsActive(true), 500)

    const eyeAnimation = setInterval(() => {
      const rand = Math.random()
      if (rand < 0.1) setEyeState("blink")
      else if (rand < 0.3) setEyeState("scan")
      else setEyeState("normal")
    }, 2000)

    return () => {
      clearTimeout(activateBot)
      clearInterval(eyeAnimation)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer energy rings */}
        <div
          className="absolute inset-0 rounded-full border-2 border-accent/20 animate-spin"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute inset-2 rounded-full border border-accent/30 animate-spin"
          style={{ animationDuration: "6s", animationDirection: "reverse" }}
        />

        {/* Main bot body */}
        <div
          className={`absolute inset-4 bg-gradient-to-br from-card via-muted to-card rounded-full shadow-2xl transition-all duration-1000 ${isActive ? "scale-100 shadow-accent/20" : "scale-95"}`}
        >
          {/* Inner glow effect */}
          <div className="absolute inset-1 bg-gradient-to-br from-accent/10 to-transparent rounded-full" />

          {/* Android head shape with Robot icon */}
          <div className="absolute inset-3 bg-gradient-to-b from-background to-muted rounded-full flex flex-col items-center justify-center">
            {/* Antenna */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="w-1 h-4 bg-[#00D4FF] rounded-full animate-pulse" />
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-[#00D4FF]/60 rounded-full animate-ping" />
            </div>

            {/* Central Robot Icon - Large and Centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-[rgb(0,104,120)]/10 text-[rgb(0,104,120)] rounded-full p-3 animate-pulse">
                <Robot 
                  weight="duotone" 
                  size={Math.max(size * 0.35, 60)}
                  className="transition-all duration-300"
                />
              </div>
            </div>

            {/* Simplified indicator dots below icon */}
            <div className="flex space-x-1 absolute bottom-3 left-1/2 transform -translate-x-1/2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full animate-pulse transition-all duration-300 ${
                    eyeState === "scan" ? "bg-[#00D4FF]" : "bg-[rgb(0,104,120)]"
                  }`}
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: "1.5s",
                  }}
                />
              ))}
            </div>

            {/* Processing indicator */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-1 bg-accent rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-accent/40 rounded-full animate-ping"
            style={{
              top: `${20 + Math.sin(i * 60) * 30}%`,
              left: `${20 + Math.cos(i * 60) * 30}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: "3s",
            }}
          />
        ))}

        {/* Holographic effect */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-accent/5 to-transparent animate-pulse"
          style={{ animationDuration: "4s" }}
        />
      </div>

      <div
        className={`text-center space-y-3 transition-all duration-1000 ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        <div className="relative">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-[#00D4FF] via-[#8B5CF6] to-[#00D4FF] bg-clip-text text-transparent animate-pulse">
            Mymediset Agent
          </h2>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent" />
        </div>
        <p className="text-muted-foreground max-w-xs leading-relaxed">
          Your personal assistant at your service. Ready to help with bookings, materials, and task scheduling.
        </p>

        {/* Status indicators */}
        <div className="flex justify-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-muted-foreground">Online</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.5s" }} />
            <span className="text-muted-foreground">Processing</span>
          </div>
        </div>
      </div>
    </div>
  )
}
