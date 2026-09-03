import { AlertTriangle } from "lucide-react";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAnnouncements } from "@/hooks/useAnnouncements";

// 게시 시작일만 보여준다. 공지에서 사람이 알고 싶은 것은 "언제부터의 이야기인가"이고,
// 수정 시각까지 붙이면 같은 글에 날짜가 둘 생겨 어느 쪽이 기준인지 되묻게 된다.
// 시·분은 쓰지 않는다 — 하루 단위로 유효한 안내에 분 단위를 적으면 없는 정밀도를 약속하는 셈이다.
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

/**
 * 공지사항 목록.
 *
 * 이 라우트는 App.tsx에서 ProtectedRoute 밖에 있다 — 오픈 안내나 점검 공지처럼
 * 가입을 고민하는 사람, 로그인이 막혀 들어오지 못하는 사람이 먼저 읽어야 하는 내용이
 * 여기 담기기 때문이다. 로그인이 필요한 화면에 두면 정작 그 공지가 필요한 순간에 닫힌다.
 * (PageShell은 Privacy·PublicProfile이 이미 비로그인으로 쓰고 있고, TopNav·BottomNav·FAB
 *  모두 user가 없을 때를 스스로 처리한다.)
 *
 * 기간·초안 여과는 RLS가 한다(20260904000004). 화면에서 다시 거르지 않는다.
 */
const Notices = () => {
  useDocumentTitle("공지사항");
  const { items, loading } = useAnnouncements();

  return (
    <PageShell title="공지사항">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2.5 pb-4">
          {items.map((a) => {
            const important = a.level === "important";
            return (
              // 평면 카드 + 헤어라인 테두리. 중요 공지는 테두리로 눈에 띄게 하되,
              // 색만으로 급함을 말하지 않도록 아래 '중요' 라벨을 함께 단다.
              <article
                key={a.id}
                className={`rounded-lg bg-card border p-4 ${important ? "border-amber/50" : "border-border"}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {important && (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" strokeWidth={2} />
                      {/* 라벨 글자는 본문색. amber 글자는 흰 바탕 대비가 2.4:1까지 떨어져
                          가장 읽혀야 할 문구가 가장 안 읽히는 글자가 된다. */}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-foreground">
                        중요
                      </span>
                    </>
                  )}
                  <span className="mono-label tabular-nums ml-auto shrink-0">
                    {formatDate(a.starts_at)}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold tracking-tight text-foreground break-words">
                  {a.title}
                </h2>
                {/* 관리자가 줄바꿈으로 문단을 나눠 쓰므로 whitespace-pre-wrap으로 살린다.
                    사용자 입력이라 텍스트로만 그린다 — innerHTML(dangerouslySetInnerHTML)로
                    넣으면 관리자 계정 하나가 뚫리는 순간 모든 방문자의 화면에서 스크립트가 돈다.
                    break-words는 줄바꿈 없는 긴 링크가 카드를 밀고 나가는 것을 막는다. */}
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words mt-2">
                  {a.body}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        // 공지는 없는 것이 정상인 날이 대부분이다. 오류처럼 보이지 않게 담담히 적는다.
        <div className="text-center py-16 text-sm text-muted-foreground">
          아직 공지가 없습니다.
        </div>
      )}
    </PageShell>
  );
};

export default Notices;
