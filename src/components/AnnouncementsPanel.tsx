import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// 공지 관리 화면 (20260904000004).
// 관리자가 쓰고 모든 사람이 읽는 한 방향 글이라, 여기서 스위치 하나 올리는 것이 곧 발행이다.
// 그 성격 때문에 화면을 만들며 정한 것들:
//
//   1. 손님용 useAnnouncements를 쓰지 않는다. 그 훅이 보는 것은 RLS가 이미 걸러낸
//      "지금 보이는 것"뿐이라, 초안과 지나간 공지가 통째로 빠진다. 정작 관리자가
//      다시 손대야 하는 것이 그 둘이다 — 목록에서 사라지면 고칠 방법도 지울 방법도 없다.
//      그래서 여기서는 announcements를 직접, 조건 없이 읽는다.
//   2. 상태(초안·게시중·예약됨·종료됨)는 화면에서 계산한다. DB에 있는 것은 is_published
//      하나뿐이고, 나머지는 게시 기간과 지금 시각을 함께 봐야 나온다. 계산식은 RLS의
//      SELECT 조건과 글자 그대로 같게 맞췄다 — 여기가 어긋나면 관리자 화면에는 "게시중"
//      인데 손님에게는 안 보이는, 화면만 보고는 절대 못 잡는 상태가 생긴다.
//   3. 게시로 넘기는 순간에만 확인을 받는다. 이미 나가 있는 글의 문구를 다듬을 때까지
//      매번 물으면 확인창이 습관이 되고, 그러면 정작 발행할 때도 읽지 않고 눌러버린다.
//   4. 기간은 저장하기 전에 화면에서 먼저 본다. DB의 announcements_period_valid에
//      걸리면 남는 것은 제약 이름이 박힌 영문 오류뿐이라, 무엇을 고쳐야 하는지 알 수 없다.

type Level = "info" | "important";

type Announcement = {
  id: string;
  title: string;
  body: string;
  level: Level;
  starts_at: string;
  ends_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type Status = "live" | "scheduled" | "draft" | "ended";

// 목록에 세우는 순서. 지금 손을 대야 할 것(나가 있는 글, 곧 나갈 글)이 위로 오고,
// 끝난 것은 맨 아래로 내려간다.
const SECTIONS: Status[] = ["live", "scheduled", "draft", "ended"];

const STATUS_LABEL: Record<Status, string> = {
  live: "게시중",
  scheduled: "예약됨 (시작 전)",
  draft: "초안",
  ended: "종료됨",
};

// 색으로만 상태를 말하지 않는다 — 배지에는 언제나 위 라벨이 함께 박힌다.
const STATUS_CLASS: Record<Status, string> = {
  live: "bg-primary/10 text-primary",
  scheduled: "bg-amber/15 text-amber",
  draft: "bg-secondary text-secondary-foreground",
  ended: "bg-secondary text-muted-foreground",
};

/**
 * 지금 이 공지가 어떤 상태인지.
 *
 * 20260904000004의 "published announcements are readable by everyone" 정책과 같은 식이다.
 * 특히 끝나는 쪽은 정책이 `ends_at > now()`를 통과 조건으로 쓰므로, 끝난 것은
 * `ends_at <= now`다 — 여기서 부등호를 하나 느슨하게 잡으면 마지막 1초 동안
 * 관리자에게만 "게시중"으로 보인다.
 */
const statusOf = (a: Announcement, now: number): Status => {
  if (!a.is_published) return "draft";
  if (new Date(a.starts_at).getTime() > now) return "scheduled";
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return "ended";
  return "live";
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** datetime-local 입력이 읽는 로컬 시각 문자열 (YYYY-MM-DDTHH:mm) */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = {
  title: "",
  body: "",
  level: "info" as Level,
  // 비워두면 "지금"·"무기한". 미리 시각을 채워두면 그럴 생각이 없던 공지가 예약글이 된다.
  startsAt: "",
  endsAt: "",
  // 초안으로 시작한다. DB 기본값과 같다 — 쓰다 만 글이 손님에게 보이면 안 된다.
  isPublished: false,
};

const AnnouncementsPanel = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 발행 확인 대기. 폼 저장으로 켜는 경우와 목록 스위치로 켜는 경우가 같은 창을 지난다.
  // 폼 쪽은 payload를 담아두지 않고 확인 뒤 submit을 다시 부른다 — 검증을 이미 통과한
  // 입력값이 form 상태에 그대로 남아 있어, 두 벌로 들고 있으면 어긋날 여지만 생긴다.
  const [publishTarget, setPublishTarget] = useState<
    { source: "form"; title: string; startsAt: Date } | { source: "row"; row: Announcement } | null
  >(null);
  // 삭제 확인은 네이티브 confirm 대신 AlertDialog로 받는다. confirm은 iOS에서 도메인이 박힌
  // 시스템 경고창을 띄워 앱이 아니라 브라우저가 말을 거는 것처럼 보이고(설치형 PWA에서 특히
  // 이질적이다), 떠 있는 동안 JS를 통째로 멈춘다. 어느 공지인지는 상태로 들고 있어야
  // 확인 문구에 제목을 실을 수 있다.
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, level, starts_at, ends_at, is_published, created_at, updated_at")
      .order("starts_at", { ascending: false });
    setLoading(false);
    if (error || !data) {
      // 손님 화면과 달리 여기서는 조용히 빈 목록으로 두지 않는다. 공지가 0건인 것과
      // 못 읽은 것을 구별하지 못하면, 이미 나가 있는 글 위에 같은 글을 또 쓰게 된다.
      toast.error("공지 목록을 불러오지 못했습니다");
      return;
    }
    // level은 DB에서 text로 내려온다(CHECK로 두 값만 들어오지만 타입에는 남지 않는다).
    // 여기서 한 번 좁혀두면 아래 화면 코드가 as 캐스트 없이 두 값만 다룰 수 있다.
    setItems(data.map((r) => ({ ...r, level: r.level === "important" ? "important" : "info" })));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 상태는 '지금'에 따라 달라지지만 초 단위로 다시 그리지는 않는다. 예약·종료의 경계를
  // 실시간으로 넘겨 보여줄 만큼 급한 화면이 아니고, 어떤 조작이든 끝나면 load()가
  // 목록을 다시 읽으면서 함께 갱신된다.
  const grouped = useMemo(() => {
    const now = Date.now();
    const buckets: Record<Status, Announcement[]> = { live: [], scheduled: [], draft: [], ended: [] };
    for (const a of items) buckets[statusOf(a, now)].push(a);
    return buckets;
  }, [items]);

  const closeForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      body: a.body,
      level: a.level,
      startsAt: toLocalInput(a.starts_at),
      endsAt: toLocalInput(a.ends_at),
      isPublished: a.is_published,
    });
    setEditingId(a.id);
    setFormOpen(true);
  };

  /**
   * confirmed는 발행 확인창을 이미 지났다는 뜻이다. 검증은 확인창을 띄우기 전에 끝내므로
   * 두 번째 호출에서 다시 걸릴 일은 없지만, 그 사이 입력이 바뀌었을 수 있으니 그대로 다시 본다.
   */
  const submit = async (confirmed: boolean) => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title) return toast.error("제목을 입력해주세요");
    if (!body) return toast.error("본문을 입력해주세요");

    // 비운 칸은 "지금"이다. DB 기본값 now()에 맡기지 않고 여기서 시각을 박는 이유가 둘 있다.
    // 하나는 방금 검증한 값과 실제로 저장되는 값이 같아야 아래 기간 검사가 의미를 갖기 때문이고,
    // 다른 하나는 수정일 때 컬럼을 빼면 기본값이 아니라 예전 값이 그대로 남기 때문이다 —
    // "지금부터"로 바꾸려고 칸을 비웠는데 옛 시각이 남으면 손을 댄 적 없는 것과 같아진다.
    const startsAt = form.startsAt ? new Date(form.startsAt) : new Date();
    const endsAt = form.endsAt ? new Date(form.endsAt) : null;
    if (Number.isNaN(startsAt.getTime())) return toast.error("게시 시작 시각을 다시 확인해주세요");
    if (endsAt && Number.isNaN(endsAt.getTime())) return toast.error("게시 종료 시각을 다시 확인해주세요");
    // DB의 announcements_period_valid와 같은 규칙. 서버까지 보내면 제약 이름이 박힌
    // 영문 오류만 돌아와, 관리자는 두 칸 중 무엇이 잘못됐는지조차 알 수 없다.
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      return toast.error("게시 종료는 시작보다 뒤여야 합니다");
    }

    const before = editingId ? items.find((a) => a.id === editingId) : null;
    // 확인이 필요한 것은 '안 보이던 것이 보이게 되는' 전환뿐이다.
    const becomesVisible = form.isPublished && !before?.is_published;
    if (becomesVisible && !confirmed) {
      setPublishTarget({ source: "form", title, startsAt });
      return;
    }

    setSubmitting(true);
    const payload = {
      title,
      body,
      level: form.level,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      is_published: form.isPublished,
    };
    // created_by·created_at은 보내지 않는다. INSERT는 트리거가 auth.uid()로 채우고,
    // UPDATE는 무엇을 보내든 트리거가 처음 쓴 사람으로 되돌린다(문구를 다듬었다고
    // 글쓴이가 바뀌면 책임 소재가 흐려지므로).
    //
    // 돌려받은 행을 확인하는 것은 RLS 때문이다. 관리자가 아니면 update가 0행을 건드리고
    // error는 비는데, select가 없으면 그 조용한 거부를 성공으로 읽게 된다.
    const { data, error } = editingId
      ? await supabase.from("announcements").update(payload).eq("id", editingId).select("id").maybeSingle()
      : await supabase.from("announcements").insert(payload).select("id").maybeSingle();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error ? (editingId ? "공지를 수정하지 못했습니다" : "공지를 저장하지 못했습니다") : "권한이 없어 저장하지 못했습니다");
      return;
    }
    toast.success(editingId ? "공지를 수정했습니다" : form.isPublished ? "공지를 게시했습니다" : "공지를 초안으로 저장했습니다");
    closeForm();
    load();
  };

  const applyPublish = async (row: Announcement, next: boolean) => {
    setBusyId(row.id);
    const { data, error } = await supabase
      .from("announcements")
      .update({ is_published: next })
      .eq("id", row.id)
      .select("id")
      .maybeSingle();
    setBusyId(null);
    if (error || !data) {
      toast.error(error ? "게시 상태를 바꾸지 못했습니다" : "권한이 없어 바꾸지 못했습니다");
      return;
    }
    toast.success(next ? "공지를 게시했습니다" : "공지를 내렸습니다");
    // 게시 여부가 바뀌면 이 글이 속한 묶음도 바뀐다. 낙관적으로 한 줄만 고치면
    // 카드가 원래 자리에 남아 어느 묶음에 있는지가 어긋나므로 통째로 다시 읽는다.
    load();
  };

  const requestPublish = (row: Announcement, next: boolean) => {
    // 내리는 쪽은 확인 없이 바로 반영한다. 손님 화면에서 글 하나가 사라질 뿐이고,
    // 되돌리는 데도 같은 스위치를 한 번 더 올리면 된다. 되돌릴 수 없는 것은 반대쪽 —
    // 한 번 나간 글은 이미 본 사람에게서 거둬들일 수 없다.
    if (next) {
      setPublishTarget({ source: "row", row });
      return;
    }
    applyPublish(row, false);
  };

  const confirmPublish = () => {
    const t = publishTarget;
    if (!t) return;
    setPublishTarget(null);
    if (t.source === "form") submit(true);
    else applyPublish(t.row, true);
  };

  const remove = async () => {
    const t = deleteTarget;
    if (!t) return;
    setDeleteTarget(null);
    setBusyId(t.id);
    const { error } = await supabase.from("announcements").delete().eq("id", t.id);
    setBusyId(null);
    if (error) return toast.error("공지를 삭제하지 못했습니다");
    // 지운 글을 폼에서 계속 고치고 있으면 저장할 때 0행이 되어 "권한 없음"처럼 보인다.
    if (editingId === t.id) closeForm();
    toast.success("공지를 삭제했습니다");
    load();
  };

  const publishTitle = publishTarget
    ? publishTarget.source === "form" ? publishTarget.title : publishTarget.row.title
    : "";
  const publishStartsAt = publishTarget
    ? publishTarget.source === "form" ? publishTarget.startsAt : new Date(publishTarget.row.starts_at)
    : null;
  // 시작 시각이 미래면 게시를 켜도 당장은 안 보인다. 그 차이를 확인 문구에서 감추면
  // 관리자는 "게시했는데 왜 안 보이지"를 사고로 의심하게 된다.
  const publishIsImmediate = !!publishStartsAt && publishStartsAt.getTime() <= Date.now();

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          공지
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          게시한 공지는 로그인하지 않은 사람에게도 보입니다. 초안으로 두면 여기에만 남고 손님 화면에는 나오지 않습니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          시작 시각을 앞으로 잡으면 그때가 되어야 나타나고, 종료 시각을 비우면 직접 내릴 때까지 계속 보입니다.
        </p>
      </Card>

      {!formOpen && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          새 공지 쓰기
        </Button>
      )}

      {formOpen && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editingId ? "공지 수정" : "새 공지"}</h2>
            <Button variant="ghost" size="sm" onClick={closeForm} aria-label="입력 폼 접기">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); submit(false); }}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="announcement-title">제목 *</Label>
              <Input
                id="announcement-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={100}
                placeholder="정기 점검 안내"
              />
            </div>
            <div>
              <Label htmlFor="announcement-body">본문 *</Label>
              <Textarea
                id="announcement-body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
                maxLength={2000}
                placeholder={"줄바꿈은 그대로 보입니다.\n\n손님이 읽을 문장 그대로 적어주세요."}
                className="text-sm"
              />
            </div>
            <div>
              <Label>중요도</Label>
              <Select value={form.level} onValueChange={(v: Level) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">일반</SelectItem>
                  <SelectItem value="important">중요</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                중요로 두면 홈 배너에서 눈에 띄게 그려집니다. 정말 급한 것만 중요로 두세요 — 전부 중요하면 아무것도 중요하지 않습니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="announcement-starts">게시 시작</Label>
                <Input
                  id="announcement-starts"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">비우면 지금부터</p>
              </div>
              <div>
                <Label htmlFor="announcement-ends">게시 종료</Label>
                <Input
                  id="announcement-ends"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">비우면 무기한</p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">게시하기</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  꺼두면 초안으로만 저장됩니다. 켜서 저장하면 손님에게 나갑니다.
                </p>
              </div>
              <Switch
                // 스위치 본체는 24px이라 손가락으로는 자주 빗나간다. 이 줄에 스위치가
                // 하나뿐이라 44px로 넓혀도 이웃과 겹치지 않는다.
                className="tap-44 mt-0.5 shrink-0"
                checked={form.isPublished}
                onCheckedChange={(next) => setForm({ ...form, isPublished: next })}
                aria-label="게시하기"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-action text-action-foreground hover:bg-action-hover"
            >
              {submitting ? "저장 중..." : editingId ? "수정 저장" : form.isPublished ? "게시하기" : "초안으로 저장"}
            </Button>
          </form>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          아직 등록된 공지가 없습니다. 지금은 손님 화면에 공지가 하나도 나오지 않습니다.
        </p>
      )}

      {SECTIONS.map((status) => {
        const rows = grouped[status];
        if (rows.length === 0) return null;
        return (
          <div key={status} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {STATUS_LABEL[status]} ({rows.length})
            </h3>
            {rows.map((a) => (
              // 끝난 글과 초안은 지금 손님이 보는 것이 아니라는 게 한눈에 드러나야 한다.
              <Card key={a.id} className={`p-3 ${status === "live" ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${STATUS_CLASS[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {a.level === "important" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold shrink-0">
                          중요
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm mt-1.5 break-words">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{a.body}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1.5 tabular-nums">
                      {fmt(a.starts_at)} ~ {a.ends_at ? fmt(a.ends_at) : "무기한"}
                    </p>
                  </div>
                  <Switch
                    className="tap-44 mt-0.5 shrink-0"
                    checked={a.is_published}
                    disabled={busyId === a.id}
                    onCheckedChange={(next) => requestPublish(a, next)}
                    aria-label={`${a.title} 게시`}
                  />
                </div>
                <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEdit(a)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive ml-auto"
                    onClick={() => setDeleteTarget(a)}
                    disabled={busyId === a.id}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    삭제
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        );
      })}

      {/* 발행 확인. 여기서 되돌릴 수 없는 것은 글이 아니라 '이미 읽힌 사실'이라,
          무엇이 나가는지(제목)와 언제부터 보이는지를 함께 보여준 뒤에 받는다. */}
      <AlertDialog open={!!publishTarget} onOpenChange={(o) => { if (!o) setPublishTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 공지를 게시할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block font-medium text-foreground break-words">{publishTitle}</span>
              <span className="block mt-2">
                {publishIsImmediate
                  ? "지금부터 모든 사용자에게 보입니다. 로그인하지 않은 사람에게도 보이고, 이미 읽은 사람에게서 되돌릴 수는 없습니다."
                  : `${publishStartsAt ? fmt(publishStartsAt.toISOString()) : ""}부터 모든 사용자에게 보입니다. 그전까지는 아무에게도 보이지 않습니다.`}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmPublish(); }}>게시하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 삭제 확인 — 본문이 통째로 사라지고 되돌릴 방법이 없다(휴지통이 없다).
          게시 중인 글이면 손님 화면에서도 같이 사라진다는 것을 함께 알린다. */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공지를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <span className="block font-medium text-foreground break-words">{deleteTarget.title}</span>
              )}
              <span className="block mt-2">
                본문까지 함께 지워지고 되돌릴 수 없습니다. 잠시 내려두려는 것이라면 삭제 대신 게시 스위치를 끄세요.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }}>삭제하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AnnouncementsPanel;
