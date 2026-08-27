import { useState, useEffect } from "react";
import logoIcon from "@/assets/logo-icon.png";

const EXPAND_MS = 450;

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setExiting(true), 1000);
    const timer2 = setTimeout(() => onFinish(), 1000 + EXPAND_MS);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={
        exiting
          ? { animation: `fade-out 0.35s ease-out ${EXPAND_MS - 350}ms both`, pointerEvents: "none" }
          : undefined
      }
    >
      <img
        src={logoIcon}
        alt="instrut"
        className={`w-24 h-24 rounded-3xl shadow-lg mb-4 ${exiting ? "splash-icon-exit" : ""}`}
        style={{
          animation: exiting
            ? `splash-expand ${EXPAND_MS}ms cubic-bezier(0.77, 0, 0.175, 1) both`
            : "splash-pop 0.6s cubic-bezier(0.16,1,0.3,1) both",
          willChange: "transform, opacity",
        }}
      />
      <span
        className="text-xl font-bold tracking-tight text-foreground"
        style={{
          animation: exiting
            ? "fade-out 0.2s ease-out both"
            : "splash-pop 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        instrut
      </span>
    </div>
  );
};

export default SplashScreen;
