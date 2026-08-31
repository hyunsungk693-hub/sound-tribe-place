import { useEffect, useState } from "react";
import { ShieldAlert, Clock3, FileUp, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  userId: string;
  purpose?: string | null;
  credentialVerified?: boolean | null;
  /** 증빙을 낼 수 있는 화면이 프로필 편집 모달뿐이라 여기서 열어준다 */
  onSubmitCredential: () => void;
  /** 활동 목적을 취미로 바꾼 뒤 부모의 프로필 상태를 맞춘다 */
  onSwitchedToHobby: () => void;
  /** 값이 바뀌면 제출 이력을 다시 읽는다 (편집 모달에서 증빙을 낸 직후) */
  refreshKey?: number;
}

/**
 * 증빙 미인증 프로에게 "왜 막혔는지"와 "어떻게 풀지"를 알리는 카드.
 *
 * 증빙 제도(20260901000005)가 생기기 전에 가입해 목적만 "프로"로 골라둔 사용자는
 * 증빙을 낸 적이 없다. 그 결과 profiles SELECT 정책에서 프로필이 남에게 안 보이고
 * profile_is_eligible()이 false라 구인글 작성·지원까지 막히는데, 정작 그 사실을
 * 알려주는 화면이 없었다. 빠져나갈 길(증빙 제출 / 목적을 취미로 변경)은 이미
 * 있었으므로 제도를 손대지 않고 안내만 붙인다.
 */
const ProCredentialNotice = ({
  userId,
  purpose,
  credentialVerified,
  onSubmitCredential,
  onSwitchedToHobby,
  refreshKey = 0,
}: Props) => {
  // 막힘 판정은 마이그레이션과 같은 두 값만 본다 — profiles 정책도
  // profile_is_eligible()도 purpose와 credential_verified만 읽는다.
  const blocked = purpose === "pro" && !credentialVerified;

  // null = 아직 조회 전. 조회가 끝나기 전에 그리면 "확인 중"인 사람에게
  // 재촉 문구가 한 프레임 스쳐 보인다.
  const [statuses, setStatuses] = useState<string[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!blocked) return;
    let alive = true;
    // 이미 증빙을 내고 기다리는 사람과 아직 아무것도 안 낸 사람을 구분해야 한다.
    // profile_credentials는 RLS상 본인·관리자만 읽으므로 내 행만 돌아온다.
    supabase
      .from("profile_credentials" as any)
      .select("status")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!alive) return;
        setStatuses(((data as any[]) || []).map((r) => r.status as string));
      });
    return () => {
      alive = false;
    };
  }, [blocked, userId, refreshKey]);

  const switchToHobby = async () => {
    setSwitching(true);
    const { error } = await supabase
      .from("profiles")
      .update({ purpose: "hobby" })
      .eq("user_id", userId);
    setSwitching(false);
    if (error) {
      toast.error("활동 목적을 바꾸지 못했습니다. 잠시 후 다시 시도해주세요");
      return;
    }
    setConfirmOpen(false);
    toast.success("활동 목적을 취미로 바꿨습니다. 프로필 공개와 구인 활동이 다시 열렸습니다.");
    onSwitchedToHobby();
  };

  // 취미 사용자와 인증을 마친 프로에게는 아무것도 보이지 않아야 한다.
  if (!blocked || statuses === null) return null;

  const hasPending = statuses.includes("pending");
  // 반려된 이력만 있으면 "안 냈다"가 아니라 "다시 내야 한다"가 맞는 안내다.
  const wasRejected = !hasPending && statuses.includes("rejected");

  // 심사 대기 중인 사람은 할 일을 다 했다. 재촉하지 않는다.
  if (hasPending) {
    return (
      <div
        className="glass-card p-5"
        style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.03s both" }}
      >
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-amber shrink-0" />
          <p className="text-sm font-bold">증빙 확인 중입니다</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          제출한 증빙을 확인하고 있습니다. 확인이 끝나면 프로필 공개와 구인글 작성·지원이 함께 열립니다.
          지금 더 하실 일은 없습니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="glass-card p-5"
        style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.03s both" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldAlert className="w-4 h-4 text-negative-foreground shrink-0" />
          <p className="text-sm font-bold">프로 인증이 없어 활동이 막혀 있습니다</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-negative text-negative-foreground">
            지금 제한 중
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
          활동 목적이 <span className="font-semibold text-foreground">프로</span>인데 증빙이 확인되지 않아
          아래 세 가지를 할 수 없습니다.
        </p>

        {/* 무엇이 막혔는지 구체적으로 적는다. "인증이 필요합니다"만으로는
            자기 화면에서 무엇이 사라졌는지 알 수 없다. */}
        <ul className="mt-3 space-y-1.5">
          {[
            "내 프로필이 다른 사람에게 보이지 않습니다",
            "구인글을 작성할 수 없습니다",
            "구인 공고에 지원할 수 없습니다",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-foreground">
              <span className="w-1 h-1 rounded-full bg-negative-foreground shrink-0 mt-[7px]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          {wasRejected
            ? "이전에 제출한 증빙이 반려되었습니다. 졸업장·합격증·입상내역 중 1건을 다시 제출하면 확인 후 풀립니다."
            : "졸업장·합격증·입상내역 중 1건을 제출하면 확인 후 풀립니다."}{" "}
          프로 활동이 아니라면 활동 목적을 취미로 바꿔도 제한이 풀립니다.
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onSubmitCredential}
            className="flex-1 h-9 rounded-lg bg-action text-action-foreground flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-action-hover transition-colors active:scale-[0.98]"
          >
            <FileUp className="w-4 h-4" /> 증빙 제출하기
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex-1 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-surface-hover transition-colors active:scale-[0.98]"
          >
            <UserRound className="w-4 h-4" /> 취미로 활동하기
          </button>
        </div>
      </div>

      {/* 활동 목적은 사용자가 고른 설정이다. 한 번의 오탭으로 바뀌면 안 되므로
          무엇이 달라지는지 적어 확인을 받는다. */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o && !switching) setConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>활동 목적을 취미로 바꿀까요?</DialogTitle>
            <DialogDescription>
              증빙 없이 바로 활동할 수 있게 되지만, 프로에게만 열린 자리는 닫힙니다.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-primary shrink-0 mt-[7px]" />
              <span>프로필이 다시 공개되고, 구인글 작성·지원이 열립니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-negative-foreground shrink-0 mt-[7px]" />
              <span className="text-negative-foreground font-medium">
                프로 전용 공고에는 지원할 수 없습니다
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0 mt-[7px]" />
              <span className="text-muted-foreground">
                나중에 프로필 편집에서 다시 프로로 되돌릴 수 있습니다 (그때는 증빙이 필요합니다)
              </span>
            </li>
          </ul>
          <DialogFooter>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={switching}
              className="h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={switchToHobby}
              disabled={switching}
              className="h-10 px-4 rounded-lg bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              {switching ? "변경 중..." : "취미로 바꾸기"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProCredentialNotice;
