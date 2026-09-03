import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BadgeCheck, Eye, ShieldQuestion, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// 작업 8 후속: 관리자 증빙 검토 화면.
// 원본 이미지는 비공개 버킷에만 있고, 여기서도 5분짜리 서명 URL로만 연다.
// DB에는 결과값(status)만 쓰고, verified_at·verified_by·purge_after는 트리거가 채운다.

type CredKind = "diploma" | "admission" | "award";
type CredStatus = "pending" | "verified" | "rejected";

type CredRow = {
  id: string;
  user_id: string;
  kind: CredKind;
  status: CredStatus;
  created_at: string;
  verified_at: string | null;
  purge_after: string | null;
};

type Applicant = { display_name: string | null; handle: string | null };

const kindLabel: Record<CredKind, string> = {
  diploma: "졸업장",
  admission: "합격증",
  award: "입상내역",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const CredentialsReview = ({ onPendingCount }: { onPendingCount?: (n: number) => void }) => {
  const [rows, setRows] = useState<CredRow[]>([]);
  const [people, setPeople] = useState<Record<string, Applicant>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 판정 확인은 네이티브 confirm 대신 AlertDialog로 받는다. confirm은 iOS에서 도메인이 박힌
  // 시스템 경고창을 띄워 앱이 아니라 브라우저가 말을 거는 것처럼 보이고, 떠 있는 동안 JS를
  // 통째로 멈춘다. 게다가 확인창 한 줄로는 "무슨 일이 일어나는지"를 제대로 못 적는다 —
  // 여기서 누른 한 번이 상대의 프로필 공개 여부와 구인 활동 가능 여부를 바꾸고, 원본이
  // 파기되고 나면 같은 근거로 다시 판단할 수도 없다. 대상과 결과를 상태로 들고 있다가
  // 다이얼로그에 그대로 풀어 쓴다.
  const [decideTarget, setDecideTarget] = useState<{ row: CredRow; status: "verified" | "rejected" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_credentials" as any)
      .select("id,user_id,kind,status,created_at,verified_at,purge_after")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setLoading(false);
      toast.error("증빙 목록을 불러오지 못했습니다");
      return;
    }
    const list = (data || []) as unknown as CredRow[];

    // profile_credentials.user_id는 auth.users를 참조하므로 profiles와 조인되지 않는다.
    // 신청자 이름은 따로 받아온다 (미인증 프로의 profiles는 관리자만 읽힌다 — 20260901000011).
    const ids = [...new Set(list.map((r) => r.user_id))];
    let map: Record<string, Applicant> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,handle")
        .in("user_id", ids);
      map = Object.fromEntries((profs || []).map((p: any) => [p.user_id, { display_name: p.display_name, handle: p.handle }]));
    }

    setRows(list);
    setPeople(map);
    setLoading(false);
    onPendingCount?.(list.filter((r) => r.status === "pending").length);
  }, [onPendingCount]);

  useEffect(() => { load(); }, [load]);

  const nameOf = (uid: string) => people[uid]?.display_name || `(닉네임 없음 · ${uid.slice(0, 8)})`;

  const openOriginal = async (r: CredRow) => {
    if (openId === r.id) { setOpenId(null); return; }
    if (urls[r.id]) { setOpenId(r.id); return; }
    setBusyId(r.id);
    const { data, error } = await supabase.storage
      .from("credentials")
      .createSignedUrl(`${r.user_id}/${r.id}`, 300);
    setBusyId(null);
    if (error || !data?.signedUrl) {
      toast.error("원본을 열 수 없습니다. 이미 파기되었을 수 있습니다.");
      return;
    }
    setUrls((u) => ({ ...u, [r.id]: data.signedUrl }));
    setOpenId(r.id);
  };

  const decide = async () => {
    const target = decideTarget;
    if (!target) return;
    const { row: r, status } = target;
    setDecideTarget(null);
    setBusyId(r.id);
    const { error } = await supabase
      .from("profile_credentials" as any)
      .update({ status } as any)
      .eq("id", r.id);
    setBusyId(null);
    if (error) {
      toast.error("처리에 실패했습니다");
      return;
    }
    toast.success(status === "verified" ? "인증 완료 처리했습니다" : "반려했습니다");
    setOpenId(null);
    load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ShieldQuestion className="w-4 h-4" />
          검토 대기 ({pending.length})
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5">
          프로 목적으로 가입한 사용자는 증빙이 인증되기 전까지 프로필이 비공개이고 구인글 작성·지원이 막혀 있습니다.
          원본은 처리 후 30일이 지나면 자동 파기되고 결과만 남습니다.
        </p>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}

      {!loading && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">검토를 기다리는 증빙이 없습니다.</p>
      )}

      {pending.map((r) => (
        <Card key={r.id} className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{nameOf(r.user_id)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {people[r.user_id]?.handle ? `@${people[r.user_id]!.handle} · ` : ""}
                {kindLabel[r.kind]} · {fmt(r.created_at)} 제출
              </p>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-secondary-foreground">
              확인 중
            </span>
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={() => openOriginal(r)} disabled={busyId === r.id}>
            {openId === r.id ? <X className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {busyId === r.id ? "여는 중..." : openId === r.id ? "원본 닫기" : "원본 보기"}
          </Button>

          {openId === r.id && urls[r.id] && (
            <div className="space-y-2">
              <img
                src={urls[r.id]}
                alt="제출된 증빙"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-border bg-secondary/40"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <a
                href={urls[r.id]}
                target="_blank"
                rel="noreferrer"
                className="block text-center text-xs text-primary underline underline-offset-2"
              >
                새 탭에서 열기 (PDF는 여기서 확인)
              </a>
              <p className="text-[11px] text-muted-foreground text-center">열람 링크는 5분 뒤 만료됩니다.</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-action text-action-foreground hover:bg-action-hover"
              onClick={() => setDecideTarget({ row: r, status: "verified" })}
              disabled={busyId === r.id}
            >
              <BadgeCheck className="w-4 h-4 mr-1.5" />
              인증 완료
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setDecideTarget({ row: r, status: "rejected" })} disabled={busyId === r.id}>
              반려
            </Button>
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <h2 className="font-semibold">처리 완료 ({done.length})</h2>
          {done.map((r) => (
            <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate text-sm">{nameOf(r.user_id)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {kindLabel[r.kind]} · {r.verified_at ? `${fmt(r.verified_at)} 처리` : "처리 시각 없음"} ·{" "}
                  {r.purge_after ? `${new Date(r.purge_after).toLocaleDateString("ko-KR")} 원본 파기 예정` : "원본 파기됨"}
                </p>
              </div>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  r.status === "verified" ? "bg-signal/15 text-signal" : "bg-destructive/10 text-destructive"
                }`}
              >
                {r.status === "verified" ? "인증 완료" : "반려"}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* 인증 · 반려 확인. 두 결정 모두 되돌리기 어렵다 — 원본은 처리 후 30일이면 파기되어
          같은 근거로 다시 볼 수 없다. 그래서 누구의 무슨 서류인지와, 그 결과 상대의 앱이
          어떻게 달라지는지를 한 화면에 모두 적는다. */}
      <AlertDialog open={!!decideTarget} onOpenChange={(o) => { if (!o) setDecideTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decideTarget?.status === "rejected" ? "이 증빙을 반려할까요?" : "이 증빙을 인증 처리할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decideTarget && (
                <span className="block font-medium text-foreground">
                  {nameOf(decideTarget.row.user_id)} · {kindLabel[decideTarget.row.kind]}
                </span>
              )}
              <span className="block mt-1">
                {decideTarget?.status === "rejected"
                  ? "프로필은 계속 비공개로 유지되고, 구인글 작성·지원도 막힌 채로 남습니다."
                  : "프로필이 공개되고 구인글 작성·지원이 열립니다."}
              </span>
              <span className="block mt-1">
                처리하면 원본은 30일 뒤 자동 파기되어 같은 서류를 다시 확인할 수 없습니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); decide(); }}>
              {decideTarget?.status === "rejected" ? "반려하기" : "인증 완료"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CredentialsReview;
