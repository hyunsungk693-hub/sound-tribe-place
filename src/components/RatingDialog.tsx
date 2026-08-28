import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// A7: 합주 후 3항목 평가. accepted 매칭 상대에게만 노출된다.
interface Props {
  open: boolean;
  onClose: () => void;
  rateeId: string;
  rateeName: string;
  jobApplicationId: string;
  onRated?: () => void;
}

const ITEMS: { key: "kept_promise" | "skill_matched" | "would_again"; label: string; desc: string }[] = [
  { key: "kept_promise", label: "약속을 지켰어요", desc: "시간·약속을 잘 지켰나요?" },
  { key: "skill_matched", label: "실력이 잘 맞았어요", desc: "기대한 실력과 맞았나요?" },
  { key: "would_again", label: "또 합주하고 싶어요", desc: "다시 함께하고 싶나요?" },
];

const RatingDialog = ({ open, onClose, rateeId, rateeName, jobApplicationId, onRated }: Props) => {
  const { user } = useAuth();
  const [vals, setVals] = useState({ kept_promise: true, skill_matched: true, would_again: true });
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
          setVals({ kept_promise: data.kept_promise, skill_matched: data.skill_matched, would_again: data.would_again });
        } else {
          setExistingId(null);
          setVals({ kept_promise: true, skill_matched: true, would_again: true });
        }
        setLoading(false);
      });
  }, [open, user, rateeId, jobApplicationId]);

  const submit = async () => {
    if (!user) return;
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
            함께한 합주는 어땠나요? 후기는 상대 프로필의 신뢰 지표에 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>
        ) : (
          <div className="space-y-2 py-1">
            {ITEMS.map((it) => {
              const on = vals[it.key];
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setVals((v) => ({ ...v, [it.key]: !v[it.key] }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                    on ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-secondary/50"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {on && <Check className="w-4 h-4" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{it.label}</span>
                    <span className="block text-xs text-muted-foreground">{it.desc}</span>
                  </span>
                </button>
              );
            })}
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
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : existingId ? "평가 수정" : "평가 남기기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
