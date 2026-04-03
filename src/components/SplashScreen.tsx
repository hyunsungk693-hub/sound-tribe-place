import { useState, useEffect } from "react";
import logoIcon from "@/assets/logo-icon.png";

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeOut(true), 1200);
    const timer2 = setTimeout(() => onFinish(), 1700);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <img
        src={logoIcon}
        alt="instrut"
        className="w-20 h-20 mb-4 animate-[splash-pop_0.6s_cubic-bezier(0.16,1,0.3,1)_both]"
      />
      <span className="text-xl font-bold tracking-tight text-foreground animate-[splash-pop_0.6s_0.2s_cubic-bezier(0.16,1,0.3,1)_both]">
        instrut
      </span>
    </div>
  );
};

export default SplashScreen;
