import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle, ToggleRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFeatureFlags, type FeatureKey } from "@/hooks/useFeatureFlags";

// 기능 토글 관리 화면 (20260904000001).
// 배포와 공개를 분리하기 위한 것이다 — 코드는 올라가 있지만 밖의 계약이 끝나야 열 수 있는
// 기능(실결제)을 코드를 되돌리지 않고 닫아두고, 문제가 터졌을 때도 배포를 기다리지 않고
// 그 기능만 즉시 닫는다.
//
// 화면을 만들면서 특히 신경 쓴 것:
//   1. 추가·삭제 버튼이 없다. 마이그레이션에 INSERT·DELETE 정책이 없어 서버가 거부하기도
//      하지만, 애초에 화면에서 키를 없앨 수 있으면 코드가 참조하는 키가 사라져 그 기능이
//      통째로 꺼진 것처럼 보이는 사고가 난다. label·description도 마찬가지로 코드가 읽는
//      설명이라 GRANT에서 빠져 있고 트리거가 되돌린다 — 여기서는 enabled만 다룬다.
//   2. 켤 때는 바로, 끌 때는 확인을 받는다. 끄는 것은 손님 화면에서 기능이 사라지는 일이고
//      되돌리려면 다시 여기까지 와야 한다. 무엇이 사라지는지는 마이그레이션이 쓴 description을
//      그대로 보여준다 — 화면에서 따로 문구를 지어내면 DB의 설명과 어긋난다.
//   3. 마지막으로 바꾼 시각을 줄마다 보여준다. "기능이 갑자기 사라졌다"는 문의가 왔을 때
//      사고인지 사람이 끈 것인지를 가장 먼저 갈라야 하는데, 그 판단이 여기서 끝난다.

type Flag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string | null;
  updated_at: string;
};

// DB는 key로만 정렬할 수 있어 그대로 두면 bookings·payments처럼 한 몸으로 움직이는 것이
// 알파벳순으로 흩어진다. 관리자가 "예약을 닫으면 결제는 어떻게 되나"를 한눈에 보게
// 서로 딸린 것끼리 붙여 둔다. 여기에 없는 키(나중 마이그레이션이 넣을 것)는 맨 뒤로
// 흘려보낸다 — 목록에서 조용히 사라지는 것보다 낯선 자리에 나타나는 편이 낫다.
const DISPLAY_ORDER: FeatureKey[] = [
  "jobs",
  "first_rehearsal",
  "community",
  "rooms",
  "bookings",
  "payments",
  "shops",
];

const orderOf = (key: string) => {
  const i = DISPLAY_ORDER.indexOf(key as FeatureKey);
  return i === -1 ? DISPLAY_ORDER.length : i;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const FeatureFlagsPanel = () => {
  // 목록은 이 화면이 직접 읽는다. useFeatureFlags의 캐시에는 updated_at이 없고,
  // 앱 전체가 쓰는 그 캐시에 관리자 화면 사정으로 컬럼을 더 얹고 싶지 않다.
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // 확인이 필요한 토글은 누른 즉시 반영하지 않고 여기 담아 둔다. next는 '누른 뒤의 값'이다.
  const [confirmTarget, setConfirmTarget] = useState<{ flag: Flag; next: boolean } | null>(null);
  // 앱 전체가 보는 캐시는 이 화면이 값을 바꾼 뒤 직접 무효화한다. 끈 사람이 탭을 옮겨
  // 곧바로 확인할 수 있어야 "정말 꺼졌나"를 두 번 누르는 일이 없다.
  const { refresh } = useFeatureFlags();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled, label, description, updated_at");
    setLoading(false);
    if (error || !data) {
      toast.error("기능 목록을 불러오지 못했습니다");
      return;
    }
    setFlags([...data].sort((a, b) => orderOf(a.key) - orderOf(b.key) || a.key.localeCompare(b.key)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async (flag: Flag, next: boolean) => {
    // 먼저 바꾸고 나중에 되돌린다. 스위치는 손가락을 떼는 순간 움직여야 눌렸다는 것이
    // 전해지고, 여기서 오가는 값은 실패해도 되돌리는 데 대가가 없는 불리언 하나뿐이다.
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
    setBusyKey(flag.key);
    const { data, error } = await supabase
      .from("feature_flags")
      .update({ enabled: next })
      .eq("key", flag.key)
      // 돌려받은 행으로 갱신하는 이유는 updated_at 때문이다. 시각은 트리거가 서버에서
      // 찍으므로 화면이 흉내 내면 실제와 어긋나고, 그 어긋난 시각이 나중에 사고 조사에
      // 쓰인다. 더불어 관리자가 아니면 RLS가 0행을 돌려주고 error는 비는데, select가
      // 없으면 그 조용한 거부를 성공으로 착각하게 된다.
      .select("key, enabled, label, description, updated_at")
      .maybeSingle();
    setBusyKey(null);
    if (error || !data) {
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: flag.enabled } : f)));
      toast.error(error ? "기능 상태를 바꾸지 못했습니다" : "권한이 없어 바꾸지 못했습니다");
      return;
    }
    setFlags((prev) => prev.map((f) => (f.key === data.key ? data : f)));
    toast.success(next ? `${flag.label} 기능을 켰습니다` : `${flag.label} 기능을 껐습니다`);
    refresh();
  };

  const requestToggle = (flag: Flag, next: boolean) => {
    // 끄는 것은 손님 화면에서 무언가가 사라지는 일이라 언제나 확인을 받는다.
    // 켜는 것은 원래대로 돌리는 쪽이라 그대로 통과시키되, payments만은 켜는 방향도
    // 위험하다 — 실 PG가 아직 없어서 켜는 순간 손님에게 모의 결제가 열린다.
    if (!next || flag.key === "payments") {
      setConfirmTarget({ flag, next });
      return;
    }
    apply(flag, next);
  };

  const confirmToggle = () => {
    const target = confirmTarget;
    if (!target) return;
    setConfirmTarget(null);
    apply(target.flag, target.next);
  };

  const paymentsTurningOn = confirmTarget?.next === true && confirmTarget.flag.key === "payments";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ToggleRight className="w-4 h-4" />
          기능 토글
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          끈 기능은 손님 화면에서 사라집니다. 주소로 직접 들어와도 안내만 보이고, 배포를 되돌리지 않아도 즉시 반영됩니다.
          이미 앱을 열어 둔 손님에게는 새로고침한 뒤부터 적용됩니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          목록은 코드가 참조하는 키 그대로입니다. 여기서 항목을 추가하거나 지울 수는 없습니다.
        </p>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {!loading && flags.length === 0 && (
        <p className="text-sm text-muted-foreground">토글할 기능이 없습니다.</p>
      )}

      {flags.map((f) => (
        <Card key={f.key} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{f.label}</p>
              {f.description && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-2 tabular-nums">
                {f.enabled ? "켜짐" : "꺼짐"} · {fmt(f.updated_at)} 변경
              </p>
            </div>
            <Switch
              // 스위치 본체는 24px이라 손가락으로는 자주 빗나간다. 카드 한 줄에 스위치가
              // 하나뿐이라 44px 영역을 넓혀도 이웃과 겹치지 않는다.
              className="tap-44 mt-0.5 shrink-0"
              checked={f.enabled}
              disabled={busyKey === f.key}
              onCheckedChange={(next) => requestToggle(f, next)}
              aria-label={`${f.label} 기능`}
            />
          </div>

          {/* 결제만 켜져 있는 동안에도 계속 경고를 세워 둔다. 실 PG 없이 열려 있는 상태는
              정상이 아니라 잠깐 지나가야 할 상태이고, 잊고 지나가면 손님이 실제로 돈이
              오가지 않는 예약을 만들게 된다. */}
          {f.key === "payments" && f.enabled && (
            <div className="rounded-lg border border-amber/30 bg-amber/10 p-3 mt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                실 PG 미연동 — 손님에게 모의 결제가 열려 있습니다
              </p>
            </div>
          )}
        </Card>
      ))}

      {/* 끄기 확인(과 결제 켜기 확인). 무엇이 사라지는지는 DB의 description을 그대로 읽어
          보여준다 — 화면이 따로 지어낸 문구는 기능이 바뀔 때 같이 바뀌지 않는다. */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) setConfirmTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget && (confirmTarget.next
                ? `${confirmTarget.flag.label} 기능을 켤까요?`
                : `${confirmTarget.flag.label} 기능을 끌까요?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.flag.description && (
                <span className="block">{confirmTarget.flag.description}</span>
              )}
              <span className="block mt-2">
                {confirmTarget?.next
                  ? "손님 화면에 다시 나타납니다. 이미 앱을 열어 둔 손님에게는 새로고침한 뒤부터 보입니다."
                  : "손님 화면에서 사라집니다. 다시 보이게 하려면 여기서 직접 켜야 합니다."}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {paymentsTurningOn && (
            <div className="rounded-lg border border-amber/30 bg-amber/10 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                실 PG가 아직 연동되지 않았습니다
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                지금 켜면 손님에게 모의 결제 화면이 열립니다. 결제한 것처럼 보이지만 실제로 돈은 오가지 않고,
                그 상태로 만들어진 예약은 나중에 사람이 하나씩 정리해야 합니다.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmToggle(); }}>
              {confirmTarget?.next ? "켜기" : "끄기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeatureFlagsPanel;
