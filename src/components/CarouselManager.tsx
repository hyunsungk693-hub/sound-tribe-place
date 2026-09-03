import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// 홈 배너 캐러셀 관리 화면 (20260901000027 · 20260901000028).
// 배너가 코드에 박혀 있어 문구 한 줄 바꾸는 데도 재배포가 필요했다. 여기서 직접 올린다.
//
// 세 가지를 특히 조심한다:
//   1. 이동 경로는 앱 내부 경로만 받는다. DB의 CHECK 제약과 같은 규칙을 화면에서도
//      먼저 걸어, 저장 실패로 알기 전에 입력 단계에서 걸러준다.
//   2. 슬라이드를 지울 때 스토리지 원본도 같이 지운다. 안 그러면 버킷에 고아 파일이
//      계속 쌓인다.
//   3. 제목·설명·경로는 선택 입력이다(20260901000028). 비어 있으면 빈 문자열이 아니라
//      NULL로 보낸다 — ''까지 통과시키면 "값 없음"이 두 갈래가 되고, DB CHECK도 ''는
//      거부한다. 제목이 없는 슬라이드는 목록에서 slide_no(#3)로 구분한다.

const BUCKET = "carousel-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Slide = {
  id: string;
  // slide_no는 행마다 한 번 매겨지고 변하지 않는 관리용 번호다.
  // 목록에서 몇 번째인지(sort_order)는 순서를 바꾸면 달라지지만 이 번호는 그대로다.
  slide_no: number;
  title: string | null;
  description: string | null;
  image_url: string;
  image_path: string | null;
  link: string | null;
  sort_order: number;
  is_active: boolean;
};

// 경로도 선택 입력이므로 기본값은 "/"가 아니라 빈 값이다.
// "/"를 미리 채워두면 이동시킬 생각이 없던 배너가 홈으로 튀게 된다.
const emptyForm = { title: "", description: "", link: "" };

// DB의 carousel_slides_link_internal과 같은 규칙.
// "//evil.com", "/\evil.com"은 브라우저가 외부 절대 URL로 읽으므로 함께 막는다.
const isInternalPath = (v: string) =>
  v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && v.length <= 200;

const CarouselManager = () => {
  const { user } = useAuth();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 삭제 확인은 네이티브 confirm 대신 AlertDialog로 받는다. confirm은 iOS에서 도메인이 박힌
  // 시스템 경고창을 띄워 앱이 아니라 브라우저가 말을 거는 것처럼 보이고(설치형 PWA에서 특히
  // 이질적이다), 떠 있는 동안 JS를 통째로 멈춘다. 목록 안에서 부르므로 어느 슬라이드인지는
  // 상태로 들고 있는다.
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null);

  // 문구가 없는 슬라이드도 있으므로, 목록과 같은 방식으로 관리 번호를 앞세워 가리킨다.
  const labelOf = (s: Slide) => {
    const label = s.title || s.description;
    return `#${s.slide_no}${label ? ` "${label}"` : ""}`;
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("carousel_slides")
      .select("id,slide_no,title,description,image_url,image_path,link,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("슬라이드 목록을 불러오지 못했습니다");
      return;
    }
    setSlides((data || []) as unknown as Slide[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 미리보기용 objectURL은 컴포넌트가 사라질 때도 반드시 되돌려준다.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const clearFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
    clearFile();
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    clearFile();
    setFormOpen(true);
  };

  const openEdit = (s: Slide) => {
    setForm({ title: s.title ?? "", description: s.description ?? "", link: s.link ?? "" });
    setEditingId(s.id);
    clearFile();
    setFormOpen(true);
  };

  // CreatePostDialog와 같은 기준: 이미지 타입만, 5MB 이하.
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("이미지 파일만 올릴 수 있습니다");
    if (f.size > MAX_IMAGE_BYTES) return toast.error("이미지 크기는 5MB 이하여야 합니다");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const uploadImage = async (f: File) => {
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f);
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  };

  const removeImage = async (path: string | null) => {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    const link = form.link.trim();
    // 제목·설명·경로는 비워도 된다. 다만 경로에 무언가 적었다면 내부 경로여야 한다.
    if (link && !isInternalPath(link)) {
      return toast.error('이동 경로는 "/jobs"처럼 앱 안의 경로만 넣을 수 있습니다');
    }
    // 이미지는 여전히 필수다. 수정할 때는 기존 이미지가 이미 있으므로 새로 고를 때만 본다.
    if (!editingId && !file) return toast.error("배너 이미지를 선택해주세요");

    setSubmitting(true);
    try {
      const uploaded = file ? await uploadImage(file) : null;

      if (editingId) {
        const target = slides.find((s) => s.id === editingId);
        // 비운 칸은 NULL로 되돌린다. ""로 저장하면 DB CHECK에 걸리고,
        // 통과하더라도 홈에서 빈 텍스트 줄이 자리를 차지한다.
        const patch: Record<string, unknown> = {
          title: title || null,
          description: description || null,
          link: link || null,
        };
        if (uploaded) {
          patch.image_url = uploaded.url;
          patch.image_path = uploaded.path;
        }
        const { error } = await supabase
          .from("carousel_slides")
          .update(patch)
          .eq("id", editingId);
        if (error) throw error;
        // 새 이미지로 교체했으면 예전 원본은 버킷에서 지운다.
        if (uploaded && target) await removeImage(target.image_path);
        toast.success("슬라이드를 수정했습니다");
      } else {
        // 새 슬라이드는 항상 맨 뒤에 붙인다.
        const nextOrder = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
        // slide_no는 넘기지 않는다 — DB가 IDENTITY로 알아서 매긴다.
        const { error } = await supabase.from("carousel_slides").insert({
          title: title || null,
          description: description || null,
          link: link || null,
          image_url: uploaded!.url,
          image_path: uploaded!.path,
          sort_order: nextOrder,
          created_by: user?.id ?? null,
        });
        if (error) {
          // 행 저장이 실패했는데 파일만 남으면 그게 곧 고아 파일이다.
          await removeImage(uploaded!.path);
          throw error;
        }
        toast.success("슬라이드를 추가했습니다");
      }
      closeForm();
      load();
    } catch {
      toast.error(editingId ? "수정에 실패했습니다" : "추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  // 순서 조정: 위/아래 한 칸. sort_order가 전부 같은 값이면 두 행만 맞바꿔도
  // 순서가 안 바뀌므로, 바뀐 배열 전체에 0..n-1을 다시 매긴다.
  const move = async (index: number, dir: "up" | "down") => {
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next.map((s, i) => ({ ...s, sort_order: i })));

    const results = await Promise.all(
      next.map((s, i) =>
        supabase.from("carousel_slides").update({ sort_order: i }).eq("id", s.id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("순서를 저장하지 못했습니다");
      load(); // 낙관적으로 바꾼 화면을 서버 상태로 되돌린다
    }
  };

  const toggleActive = async (s: Slide) => {
    setBusyId(s.id);
    const { error } = await supabase
      .from("carousel_slides")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    setBusyId(null);
    if (error) return toast.error("상태를 바꾸지 못했습니다");
    setSlides((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  };

  const remove = async () => {
    const s = deleteTarget;
    if (!s) return;
    setDeleteTarget(null);
    setBusyId(s.id);
    // 행을 먼저 지운다. 파일을 먼저 지우면 삭제가 중간에 끊겼을 때
    // 홈에 이미지 깨진 배너가 남는다.
    const { error } = await supabase.from("carousel_slides").delete().eq("id", s.id);
    if (error) {
      setBusyId(null);
      return toast.error("삭제에 실패했습니다");
    }
    await removeImage(s.image_path);
    setBusyId(null);
    if (editingId === s.id) closeForm();
    toast.success("삭제되었습니다");
    load();
  };

  const activeCount = slides.filter((s) => s.is_active).length;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold">홈 배너 ({activeCount}장 노출 중)</h2>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          홈 최상단 캐러셀에 순서대로 나옵니다. 비활성으로 두면 목록에는 남고 홈에서만 빠집니다.
          노출 중인 슬라이드가 하나도 없으면 홈은 기본 배너 3장으로 되돌아갑니다.
          이미지만 있으면 등록되고 제목·설명·이동 경로는 비워도 됩니다. 목록의 #번호는
          관리용이라 홈에는 나오지 않습니다.
        </p>
      </Card>

      {!formOpen && (
        <Button variant="outline" className="w-full" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          새 슬라이드 추가
        </Button>
      )}

      {formOpen && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editingId ? "슬라이드 수정" : "새 슬라이드"}</h2>
            <Button variant="ghost" size="sm" onClick={closeForm} aria-label="입력 폼 접기">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>배너 이미지 {editingId ? "(바꿀 때만 선택)" : "*"}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                className="hidden"
              />
              {preview ? (
                <div className="relative mt-1.5 rounded-lg overflow-hidden border border-border">
                  <img src={preview} alt="선택한 배너 미리보기" className="w-full h-[140px] object-cover" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={clearFile}
                    aria-label="선택한 이미지 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  이미지 선택 (5MB 이하)
                </Button>
              )}
            </div>
            <div>
              <Label>제목 (선택)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={40}
                placeholder="Find"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                배너 위에 작게 붙는 라벨입니다. 비우면 이미지만 나옵니다.
              </p>
            </div>
            <div>
              <Label>설명 (선택)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={120}
                placeholder="믿을 수 있는 밴드·세션 멤버 찾기"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                이미지에 문구가 이미 그려져 있다면 비워두세요.
              </p>
            </div>
            <div>
              <Label>이동 경로 (선택)</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                maxLength={200}
                placeholder="/jobs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                앱 안의 경로만 넣을 수 있습니다 (예: /jobs, /rooms, /community). 외부 주소는 저장되지 않습니다.
                비우면 배너를 눌러도 이동하지 않습니다.
              </p>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-action text-action-foreground hover:bg-action-hover"
            >
              {submitting ? "저장 중..." : editingId ? "수정 저장" : "추가"}
            </Button>
          </form>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {!loading && slides.length === 0 && (
        <p className="text-sm text-muted-foreground">
          등록된 슬라이드가 없습니다. 지금은 홈에 기본 배너 3장이 나옵니다.
        </p>
      )}

      <div className="space-y-2">
        {slides.map((s, i) => (
          <Card key={s.id} className={`p-3 ${s.is_active ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <img
                src={s.image_url}
                alt=""
                className="w-24 h-14 object-cover rounded border border-border shrink-0 bg-secondary"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* 제목이 없는 슬라이드끼리도 구분되도록 번호를 항상 앞에 붙인다.
                      순서(i + 1)는 위/아래 버튼에 따라 바뀌지만 이 번호는 고정이다. */}
                  <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-foreground shrink-0">
                    #{s.slide_no}
                  </span>
                  {s.title && (
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground truncate">
                      {s.title}
                    </span>
                  )}
                  {!s.is_active && (
                    <span className="px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-semibold shrink-0">
                      비활성
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm truncate mt-0.5">
                  {s.description || (
                    <span className="font-normal text-muted-foreground">문구 없는 이미지 배너</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {i + 1}번째 · {s.link || "이동 없음"}
                </p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => move(i, "up")}
                  disabled={i === 0}
                  aria-label="위로 이동"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => move(i, "down")}
                  disabled={i === slides.length - 1}
                  aria-label="아래로 이동"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => toggleActive(s)}
                disabled={busyId === s.id}
              >
                {s.is_active ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                {s.is_active ? "숨기기" : "노출하기"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEdit(s)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                수정
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-destructive ml-auto"
                onClick={() => setDeleteTarget(s)}
                disabled={busyId === s.id}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                삭제
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* 슬라이드 삭제 확인 — 행만 지우는 것이 아니라 스토리지의 이미지 원본까지 함께
          지운다(고아 파일이 쌓이지 않게 하려고). 원본은 다시 올리지 않으면 되돌릴 수
          없으므로 그 사실을 확인 문구에 반드시 남긴다. */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>슬라이드를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <span className="block font-medium text-foreground">{labelOf(deleteTarget)}</span>
              )}
              <span className="block mt-1">
                이미지 원본도 함께 지워집니다. 되돌리려면 이미지를 다시 올려야 합니다.
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

export default CarouselManager;
