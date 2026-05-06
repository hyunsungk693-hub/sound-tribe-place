import { useEffect, useState, ReactNode } from "react";

const PHONE_RATIO = 9 / 19.5; // width / height

export const usePhoneFrameSize = () => {
  const [size, setSize] = useState<{ w: number; h: number; isMobile: boolean }>(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 820,
    isMobile: typeof window !== "undefined" ? window.innerWidth < 640 : true,
  }));

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isMobile = vw < 640;
      if (isMobile) {
        setSize({ w: vw, h: vh, isMobile: true });
        return;
      }
      let h = Math.min(vh * 0.94, 900);
      let w = h * PHONE_RATIO;
      if (w > vw * 0.9) {
        w = vw * 0.9;
        h = w / PHONE_RATIO;
      }
      setSize({ w: Math.round(w), h: Math.round(h), isMobile: false });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  return size;
};

const PhoneShell = ({ children }: { children: ReactNode }) => {
  const { w, h, isMobile } = usePhoneFrameSize();

  if (isMobile) {
    return <div className="w-full min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="fixed inset-0 bg-muted flex items-center justify-center overscroll-none">
      <div
        className="relative bg-background overflow-hidden rounded-[2.5rem] shadow-2xl border border-border"
        style={{ width: w, height: h }}
      >
        <div className="absolute inset-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PhoneShell;
