import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Flag, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

// 평가 신고 검토. 신고가 들어오면 해당 평가는 즉시 산정에서 빠지므로(20260901000004),
// 검토가 없으면 "신고만 하면 나쁜 평판이 사라지는" 구멍이 된다.
// 판정은 resolve_rating_report RPC 한 번으로 신고 상태·disputed·지표를 함께 맞춘다.

type ReportStatus = "pending" | "upheld" | "dismissed";

type Report = {
  id: string;
  rating_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  admin_note: string | null;
};

type Rating = {
  id: string;
  rater_id: string;
  ratee_id: string;
  kept_promise: boolean | null;
  skill_matched: boolean | null;
  would_again: boolean | null;
  disputed: boolean;
  created_at: string;
};

type Person = { display_name: string | null; handle: string | null };

const ITEMS: [keyof Pick<Rating, "kept_promise" | "skill_matched" | "would_again">, string][] = [
  ["kept_promise", "약속 지킴"],
  ["skill_matched", "실력 일치"],
  ["would_again", "또 하고 싶음"],
];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const ReportsReview = ({ onPendingCount }: { onPendingCount?: (n: number) => void }) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rating_reports" as any)
      .select("id,rating_id,reporter_id,reason,status,created_at,resolved_at,admin_note")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setLoading(false);
      toast.error("신고 목록을 불러오지 못했습니다");
      return;
    }
    const list = (data || []) as unknown as Report[];

    // 평가 본문과 당사자 이름은 각각 다른 테이블이라 따로 받아 붙인다
    const ratingIds = [...new Set(list.map((r) => r.rating_id))];
    let ratingMap: Record<string, Rating> = {};
    if (ratingIds.length) {
      const { data: rows } = await supabase
        .from("peer_ratings" as any)
        .select("id,rater_id,ratee_id,kept_promise,skill_matched,would_again,disputed,created_at")
        .in("id", ratingIds);
      ratingMap = Object.fromEntries(((rows || []) as any[]).map((r) => [r.id, r as Rating]));
    }

    const userIds = [
      ...new Set([
        ...list.map((r) => r.reporter_id),
        ...Object.values(ratingMap).flatMap((r) => [r.rater_id, r.ratee_id]),
      ]),
    ];
    let personMap: Record<string, Person> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,handle")
        .in("user_id", userIds);
      personMap = Object.fromEntries(
        ((profs || []) as any[]).map((p) => [p.user_id, { display_name: p.display_name, handle: p.handle }]),
      );
    }

    setReports(list);
    setRatings(ratingMap);
    setPeople(personMap);
    setLoading(false);
    onPendingCount?.(list.filter((r) => r.status === "pending").length);
  }, [onPendingCount]);

  useEffect(() => { load(); }, [load]);

  const nameOf = (uid: string | undefined) =>
    (uid && people[uid]?.display_name) || (uid ? `(닉네임 없음 · ${uid.slice(0, 8)})` : "(알 수 없음)");

  const decide = async (r: Report, decision: "upheld" | "dismissed") => {
    const rating = ratings[r.rating_id];
    const ok = confirm(
      decision === "upheld"
        ? `신고를 인정할까요?\n이 평가는 ${nameOf(rating?.ratee_id)}님의 등급 산정에서 계속 제외됩니다.`
        : `신고를 기각할까요?\n이 평가가 ${nameOf(rating?.ratee_id)}님의 등급 산정에 다시 포함됩니다.`,
    );
    if (!ok) return;
    setBusyId(r.id);
    const { error } = await supabase.rpc("resolve_rating_report" as any, {
      p_report_id: r.id,
      p_decision: decision,
      p_note: notes[r.id]?.trim() || null,
    } as any);
    setBusyId(null);
    if (error) {
      toast.error("처리에 실패했습니다");
      return;
    }
    toast.success(decision === "upheld" ? "신고를 인정했습니다" : "신고를 기각했습니다");
    load();
  };

  const pending = reports.filter((r) => r.status === "pending");
  const done = reports.filter((r) => r.status !== "pending");

  const ratingChips = (rating: Rating | undefined) => {
    if (!rating) return <p className="text-[11px] text-muted-foreground">평가가 삭제되었습니다.</p>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map(([key, label]) => {
          const ans = rating[key];
          return (
            <span
              key={key}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                ans === true
                  ? "bg-signal/15 text-signal"
                  : ans === false
                    ? "bg-negative text-negative-foreground"
                    : "bg-muted text-muted-foreground/70"
              }`}
            >
              {ans === true ? "✓" : ans === false ? "✗" : "–"} {label}
            </span>
          );
        })}
      </div>
    );
  };

  const personLink = (uid: string | undefined, role: string) => (
    <button
      type="button"
      disabled={!uid}
      onClick={() => uid && navigate(`/profile/${uid}`)}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2 disabled:text-muted-foreground disabled:no-underline"
    >
      {role} {nameOf(uid)} <ExternalLink className="w-3 h-3" />
    </button>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Flag className="w-4 h-4" />
          검토 대기 ({pending.length})
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5">
          신고가 접수되면 해당 평가는 접수 즉시 등급 산정에서 빠집니다. 여기서 처리하지 않으면 계속 제외된 채로 남습니다.
          기각하면 그 평가가 다시 산정에 포함됩니다.
        </p>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {!loading && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">검토를 기다리는 신고가 없습니다.</p>
      )}

      {pending.map((r) => {
        const rating = ratings[r.rating_id];
        return (
          <Card key={r.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                {personLink(r.reporter_id, "신고자 ·")}
                <div>{personLink(rating?.rater_id, "평가 작성자 ·")}</div>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fmt(r.created_at)}</span>
            </div>

            <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground">신고된 평가 내용</p>
              {ratingChips(rating)}
              {rating && (
                <p className="font-mono text-[10px] text-muted-foreground">{fmt(rating.created_at)} 작성</p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">신고 사유</p>
              <p className="text-sm whitespace-pre-wrap break-words">{r.reason}</p>
            </div>

            <Textarea
              rows={2}
              placeholder="처리 메모 (선택, 500자 이내)"
              maxLength={500}
              value={notes[r.id] || ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-action text-action-foreground hover:bg-action-hover"
                onClick={() => decide(r, "upheld")}
                disabled={busyId === r.id}
              >
                신고 인정 · 산정 제외 유지
              </Button>
              <Button variant="outline" onClick={() => decide(r, "dismissed")} disabled={busyId === r.id}>
                기각 · 다시 포함
              </Button>
            </div>
          </Card>
        );
      })}

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="font-semibold">처리 완료 ({done.length})</h2>
          {done.map((r) => (
            <Card key={r.id} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium truncate">{nameOf(ratings[r.rating_id]?.ratee_id)}님이 받은 평가</span>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    r.status === "upheld" ? "bg-negative text-negative-foreground" : "bg-signal/15 text-signal"
                  }`}
                >
                  {r.status === "upheld" ? "인정 · 제외" : "기각 · 포함"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {r.resolved_at ? `${fmt(r.resolved_at)} 처리` : "처리 시각 없음"}
                {r.admin_note ? ` · ${r.admin_note}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsReview;
