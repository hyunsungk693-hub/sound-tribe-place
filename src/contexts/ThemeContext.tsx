import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // 미니멀 리디자인: 라이트 모드 고정 (다크/시스템 비활성)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "system");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }, []);

  const setTheme = (_t: Theme) => {
    /* 라이트 고정 — 테마 전환 비활성 */
  };

  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme, resolvedTheme: "light" }}>
      {children}
    </ThemeContext.Provider>
  );
};
