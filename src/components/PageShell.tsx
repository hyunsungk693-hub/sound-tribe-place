import BottomNav from "./BottomNav";
import CreatePostFab from "./CreatePostFab";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  headerExtra?: React.ReactNode;
}

const PageShell = ({ children, title, headerExtra }: PageShellProps) => (
  <div className="relative flex flex-col min-h-app bg-background">
    {title && (
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight shrink-0">{title}</h1>
          {headerExtra}
        </div>
      </header>
    )}
    <main className="flex-1 max-w-lg w-full mx-auto px-4 pb-4 pt-4">{children}</main>
    <CreatePostFab />
    <BottomNav />
  </div>
);

export default PageShell;
