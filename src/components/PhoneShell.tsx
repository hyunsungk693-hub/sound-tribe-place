import { useEffect, useState, ReactNode } from "react";

// Common modern phone aspect ratios (w/h)
const RATIOS = {
  tall: 9 / 19.5, // iPhone 13/14/15
  medium: 9 / 18,
  short: 3 / 4, // tablet-ish
};

const MOBILE_BREAKPOINT = 640;
const TABLET_BREAKPOINT = 1024;

export const usePhoneFrameSize = () => {
  const [size, setSize] = useState<{ w: number; h: number; isMobile: boolean }>(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 820,
    isMobile: typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : true,
  }));

  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Mobile(가로모드 포함): 화면을 그대로 채움 — 높이가 작으면 프레임이 깨지므로 함께 검사
      if (vw < MOBILE_BREAKPOINT || vh < MOBILE_BREAKPOINT) {
        setSize({ w: vw, h: vh, isMobile: true });
        return;
      }

      // Pick a sensible aspect ratio based on viewport orientation
      const viewportRatio = vw / vh;
      let ratio = RATIOS.tall;
      if (viewportRatio > 1.6) ratio = RATIOS.tall; // wide desktop → tall phone
      else if (vw < TABLET_BREAKPOINT) ratio = RATIOS.medium; // tablet portrait
      else ratio = RATIOS.tall;

      // Use ~94% of viewport height as the budget, capped sensibly
      const maxH = Math.min(vh * 0.94, 920);
      let h = maxH;
      let w = h * ratio;

      // Ensure width fits in viewport (leave 8% margin)
      const maxW = vw * 0.92;
      if (w > maxW) {
        w = maxW;
        h = w / ratio;
      }

      // Avoid sub-minimum sizes
      w = Math.max(320, Math.round(w));
      h = Math.max(560, Math.round(h));

      setSize({ w, h, isMobile: false });
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
    return <div className="w-full min-h-app bg-background">{children}</div>;
  }

  return (
    <div className="fixed inset-0 bg-muted flex items-center justify-center overscroll-none">
      <div
        className="relative bg-background overflow-hidden rounded-[2.5rem] shadow-2xl border border-border"
        style={{ width: w, height: h }}
      >
        <div
          className="absolute inset-0 overflow-y-auto scrollbar-hide"
          style={{
            overscrollBehavior: "none",
            WebkitOverflowScrolling: "auto",
            scrollBehavior: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default PhoneShell;
