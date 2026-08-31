import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// A7: 합주 후 3항목 평가. accepted 매칭 상대에게만 노출된다.
//
// 각 항목은 예 / 아니오 / 미선택 3상태다. 셋 다 켜진 채로 시작하던 예전 UI는
// 토글을 끈 것이 "아니오"인지 "답 안 함"인지 구분되지 않았고, 한 항목만
// 말하고 싶어도 나머지 둘에 입장을 강요했다. 하나만 답해도 저장된다.
interface Props {
  open: boolean;
  onClose: () => void;
  rateeId: string;
  rateeName: string;
  jobApplicationId: string;
  onRated?: () => void;
}

type Key = "kept_promise" | "skill_matched" | "would_again";
type Answers = Record<Key, boolean | null>;

const ITEMS: { key: Key; label: string; desc: string }[] = [
  { key: "kept_promise", label: "약속을 지켰나요?", desc: "시간·약속을 잘 지켰는지" },
  { key: "skill_matched", label: "실력이 잘 맞았나요?", desc: "기대한 실력과 맞았는지" },
  { key: "would_again", label: "또 합주하고 싶나요?", desc: "다시 함께하고 싶은지" },
];

const EMPTY: Answers = { kept_promise: null, skill_matched: null, would_again: null };

const RatingDialog = ({ open, onClose, rateeId, rateeName, jobApplicationId, onRated }: Props) => {
  const { user } = useAuth();
  const [vals, setVals] = useState<Answers>(EMPTY);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (supabase as any)
      .from("peer_ratings")
      .select("id, kept_promise, skill_matched, would_again")
      .eq("rater_id", user.id)
      .eq("ratee_id", rateeId)
      .eq("job_application_id", jobApplicationId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setExistingId(data.id);
          setVals({
            kept_promise: data.kept_promise ?? null,
            skill_matched: data.skill_matched ?? null,
            would_again: data.would_again ?? null,
          });
        } else {
          setExistingId(null);
          setVals(EMPTY);
        }
        setLoading(false);
      });
  }, [open, user, rateeId, jobApplicationId]);

  /** 같은 답을 다시 누르면 선택이 풀린다 — 잘못 누른 답을 되돌릴 방법이 필요하다 */
  const pick = (key: Key, answer: boolean) =>
    setVals((v) => ({ ...v, [key]: v[key] === answer ? null : answer }));

  const answered = ITEMS.filter((it) => vals[it.key] !== null).length;

  const submit = async () => {
    if (!user) return;
    // 전부 비운 후기는 등급 모수만 올리고 아무 말도 하지 않는다 (DB CHECK와 같은 규칙)
    if (answered === 0) {
      toast.error("한 가지 이상 답해주세요");
      return;
    }
    setSaving(true);
    let error;
    if (existingId) {
      ({ error } = await (supabase as any).from("peer_ratings").update(vals).eq("id", existingId));
    } else {
      ({ error } = await (supabase as any).from("peer_ratings").insert({
        rater_id: user.id,
        ratee_id: rateeId,
        job_application_id: jobApplicationId,
        ...vals,
      }));
    }
    setSaving(false);
    if (error) { toast.error("평가 저장에 실패했습니다"); return; }
    toast.success(existingId ? "평가를 수정했습니다" : "평가를 남겼습니다");
    onRated?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rateeName}님과의 합주 후기</DialogTitle>
          <DialogDescription>
            답하고 싶은 항목만 골라도 됩니다. 후기는 상대 프로필의 신뢰 지표에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>
        ) : (
          <div className="space-y-2 py-1">
            {ITEMS.map((it) => {
              const v = vals[it.key];
              return (
                <div key={it.key} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">{it.label}</span>
                    <span className="block text-xs text-muted-foreground">{it.desc}</span>
                  </span>
                  <span className="flex gap-1.5 shrink-0">
                    {([[true, "예"], [false, "아니오"]] as [boolean, string][]).map(([ans, label]) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={v === ans}
                        onClick={() => pick(it.key, ans)}
                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 ${
                          v === ans
                            ? ans
                              ? "bg-action text-action-foreground"
                              : "bg-negative text-negative-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-surface-hover"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {answered === 0
                ? "한 가지 이상 답하면 저장할 수 있습니다."
                : `${answered}가지 답함 · 답하지 않은 항목은 집계에서 빠집니다.`}
            </p>
          </div>
        )}
        <DialogFooter>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
          >
            닫기
          </button>
          <button
            onClick={submit}
            disabled={saving || loading || answered === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-action text-action-foreground hover:bg-action-hover transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : existingId ? "평가 수정" : "평가 남기기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
