import { Component, ReactNode } from "react";
import { captureError } from "@/lib/analytics";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 렌더 도중 던져진 예외를 여기서 잡는다.
 *
 * 이게 없으면 React는 트리 전체를 걷어내고 화면에 아무것도 남기지 않는다. 사용자에게는
 * 흰 화면이고, 앱이 죽었다고 판단해 그대로 떠난다. 무엇이 터졌는지 남는 기록도 없어서
 * 우리도 알 수 없다. 실제로 결제 단계에 들어갈 때 그렇게 되는 코드가 있었다.
 *
 * 여기서 하는 일은 두 가지뿐이다 — 사람에게는 돌아갈 길을 주고, 우리에게는 무엇이
 * 터졌는지 남긴다. 오류 내용 자체는 화면에 쓰지 않는다. 사용자가 할 수 있는 일이
 * 없는데 내부 사정만 드러내는 꼴이 된다.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    captureError(error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-app bg-background flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div>
          <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Error</p>
          <h1 className="text-xl font-extrabold tracking-tight mt-2">화면을 그리지 못했습니다</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            잠깐의 문제일 수 있습니다. 다시 시도해보시고, 계속된다면 프로필 &rsaquo; 고객센터로 알려주세요.
          </p>
        </div>
        <div className="flex gap-2">
          {/* 상태를 되돌리는 것이 아니라 다시 불러온다. 무엇이 어긋나 터졌는지 모르는
              상태에서 그 화면을 그대로 다시 그리면 대개 같은 자리에서 또 터진다. */}
          <button
            onClick={() => window.location.reload()}
            className="px-4 h-11 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover active:scale-[0.96] transition-transform"
          >
            다시 시도
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="px-4 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-surface-hover active:scale-[0.96] transition-transform"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
