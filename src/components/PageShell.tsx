import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import CreatePostFab from "./CreatePostFab";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  headerExtra?: React.ReactNode;
}

const PageShell = ({ children, title, headerExtra }: PageShellProps) => (
  <div className="relative flex flex-col min-h-app bg-background">
    <TopNav />
    {title && (
      <header
        className="sticky top-0 lg:top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight shrink-0">{title}</h1>
          {headerExtra}
        </div>
      </header>
    )}
    {/* 모바일: 하단 고정 탭바 높이만큼 여백 / 데스크톱: 일반 여백 */}
    <main className="page-main-pb flex-1 max-w-lg lg:max-w-5xl w-full mx-auto px-4 lg:px-8 pt-4 lg:pt-8">
      {children}
    </main>
    <CreatePostFab />
    <BottomNav />
  </div>
);

export default PageShell;
