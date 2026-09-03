import { useNavigate } from "react-router-dom";
import { Megaphone, AlertTriangle, X } from "lucide-react";
import { useAnnouncements, useDismissedNotices } from "@/hooks/useAnnouncements";

/**
 * 홈 상단 공지 배너.
 *
 * 게시 중인 공지 중 가장 최근 한 건만 그린다. 여러 건을 쌓지 않는 이유는 홈이
 * 공지판이 되기 때문이다 — 홈은 각 기능으로 들어가는 문이 모인 화면이고, 그 문 위에
 * 운영자 글이 세 줄 네 줄 쌓이면 정작 여기 온 이유(구인글·연습실)가 화면 밖으로 밀린다.
 * 나머지는 /notices에 있고, 이 배너를 누르면 그리로 간다.
 *
 * 기간과 초안 여부는 RLS가 이미 걸렀다(20260904000004). 여기서 다시 거르지 않는다 —
 * 조건을 양쪽에 두면 한쪽만 고쳤을 때 어긋남이 조용히 생긴다.
 *
 * 공지가 없거나 전부 닫았으면 아무것도 그리지 않는다. 빈 카드나 자리표시를 남기면
 * 공지가 0건인 지금(대부분의 날) 홈 맨 위에 이유 없는 여백이 생긴다.
 */
const NoticeBanner = () => {
  const navigate = useNavigate();
  const { items, loading } = useAnnouncements();
  const { dismissed, dismiss } = useDismissedNotices();

  // 훅이 최신순으로 주므로 닫지 않은 첫 건이 곧 "가장 최근 공지"다.
  // 조회가 끝나기 전에는 아무것도 고르지 않는다 — 빈 상태를 한 프레임 그렸다가
  // 배너가 튀어나오면 그 사이에 누른 손가락이 엉뚱한 것을 누른다.
  const notice = loading ? null : (items ?? []).find((a) => !dismissed.includes(a.id)) ?? null;

  if (!notice) return null;

  const important = notice.level === "important";

  return (
    // 평면 카드 + 헤어라인 테두리. 중요 공지는 테두리 색으로 눈에 띄게 하되,
    // 색을 못 보는 사람에게는 아래 '중요' 라벨이 같은 말을 대신 전한다.
    <div
      className={`mb-5 flex items-start gap-2 rounded-lg bg-card border ${
        important ? "border-amber/50" : "border-border"
      }`}
    >
      {/* 본문 전체를 버튼으로 둔다(닫기 버튼과 형제 관계다).
          카드 전체를 감싼 div에 onClick을 걸고 그 안에 닫기 버튼을 넣으면 클릭이 겹쳐
          닫으려다 이동하게 되고, 키보드로는 닫기에 닿기 전에 카드가 먼저 잡힌다. */}
      <button
        onClick={() => navigate("/notices")}
        aria-label={`공지사항 열기 — ${notice.title}`}
        className="flex-1 min-w-0 text-left px-3.5 py-3 rounded-l-lg hover:bg-surface-hover transition-colors active:scale-[0.99]"
      >
        <div className="flex items-center gap-1.5 mb-1">
          {important ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" strokeWidth={2} />
          ) : (
            <Megaphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={2} />
          )}
          {important ? (
            // 라벨 글자는 본문색으로 둔다. 파스텔 배경 위 amber 글자는 흰 바탕 대비가
            // 2.4:1까지 떨어져, 정작 급함을 알려야 할 문구가 가장 안 읽히는 글자가 된다.
            // 색은 배경 틴트와 아이콘이 맡고, 뜻은 글자가 맡는다.
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-foreground">
              중요
            </span>
          ) : (
            <span className="mono-label">공지</span>
          )}
        </div>
        <p className="text-sm font-semibold tracking-tight text-foreground truncate">{notice.title}</p>
        {/* 본문은 두 줄까지만. 공지가 길어도 홈의 세로 자리는 정해져 있으므로,
            여기서는 "무슨 일이 있는지"만 알리고 전문은 /notices에서 읽게 한다.
            사용자 입력이므로 텍스트로만 그린다(innerHTML 금지). */}
        <p className="text-xs leading-relaxed text-muted-foreground mt-1 line-clamp-2 break-words">
          {notice.body}
        </p>
      </button>

      {/* 닫기. 보이는 크기는 32px이지만 .tap-44로 닿는 영역만 44px로 넓힌다.
          옆 버튼과는 gap-2(8px) 떨어져 있어 넓어진 영역(각 변 +6px)이 본문 버튼을
          침범하지 않는다 — 겹치면 공지를 읽으려다 닫히게 된다. */}
      <button
        onClick={() => dismiss(notice.id)}
        aria-label="이 공지 닫기"
        className="tap-44 shrink-0 mt-2.5 mr-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors active:scale-95"
      >
        <X className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
};

export default NoticeBanner;
