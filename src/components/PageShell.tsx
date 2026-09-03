import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import CreatePostFab from "./CreatePostFab";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  headerExtra?: React.ReactNode;
  /**
   * 페이지가 자기 상단 헤더로 안전영역을 이미 처리하고 있을 때 켠다.
   * 그런 헤더는 대개 sticky라 본문 여백 위로 올라붙으므로 본문이 대신 떠안아 줄 수 없고,
   * 본문까지 인셋을 더하면 처음 그릴 때만 그만큼 아래로 밀려 보인다(홈이 그 경우다).
   */
  ownsSafeTop?: boolean;
}

const PageShell = ({ children, title, headerExtra, ownsSafeTop }: PageShellProps) => (
  <div className="relative flex flex-col min-h-app bg-background">
    <TopNav />
    {title && (
      <header
        className="sticky top-0 lg:top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30"
        style={{ paddingTop: "var(--safe-top, 0px)" }}
      >
        <div className="max-w-lg lg:max-w-[1180px] mx-auto px-4 lg:px-8 h-14 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight shrink-0">{title}</h1>
          {headerExtra}
        </div>
      </header>
    )}
    {/* 모바일: 하단 고정 탭바 높이만큼 여백 / 데스크톱: 일반 여백.
        상단은 헤더가 있으면 그 헤더가 안전영역을 떠안으므로 본문은 평범한 여백이면 되고,
        헤더가 없으면 본문이 화면 꼭대기에서 시작하므로 본문이 직접 떠안아야 한다. */}
    <main
      className={`page-main-pb flex-1 max-w-lg lg:max-w-[1180px] w-full mx-auto px-4 lg:px-8 ${
        title || ownsSafeTop ? "pt-4 lg:pt-8" : "page-main-pt"
      }`}
    >
      {children}
    </main>
    <CreatePostFab />
    <BottomNav />
  </div>
);

export default PageShell;
