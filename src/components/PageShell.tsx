import BottomNav from "./BottomNav";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
}

const PageShell = ({ children, title }: PageShellProps) => (
  <div className="min-h-screen bg-background">
    {title && (
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
      </header>
    )}
    <main className="max-w-lg mx-auto px-4 pb-24 pt-4">{children}</main>
    <BottomNav />
  </div>
);

export default PageShell;
