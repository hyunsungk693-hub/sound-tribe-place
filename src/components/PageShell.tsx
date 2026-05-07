import BottomNav from "./BottomNav";
import MessagesFab from "./MessagesFab";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
}

const PageShell = ({ children, title }: PageShellProps) => (
  <div className="relative flex flex-col min-h-screen bg-background">
    {title && (
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
    )}
    <main className="flex-1 max-w-lg w-full mx-auto px-4 pb-4 pt-4">{children}</main>
    <BottomNav />
    <MessagesFab />
  </div>
);

export default PageShell;
