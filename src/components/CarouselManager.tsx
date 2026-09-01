import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";

// 홈 배너 캐러셀 관리 화면 (20260901000027).
// 배너가 코드에 박혀 있어 문구 한 줄 바꾸는 데도 재배포가 필요했다. 여기서 직접 올린다.
//
// 두 가지를 특히 조심한다:
//   1. 이동 경로는 앱 내부 경로만 받는다. DB의 CHECK 제약과 같은 규칙을 화면에서도
//      먼저 걸어, 저장 실패로 알기 전에 입력 단계에서 걸러준다.
//   2. 슬라이드를 지울 때 스토리지 원본도 같이 지운다. 안 그러면 버킷에 고아 파일이
//      계속 쌓인다.

const BUCKET = "carousel-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Slide = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  image_path: string | null;
  link: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm = { title: "", description: "", link: "/" };

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("carousel_slides" as any)
      .select("id,title,description,image_url,image_path,link,sort_order,is_active")
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
    setForm({ title: s.title, description: s.description, link: s.link });
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
    if (!title) return toast.error("제목을 입력해주세요");
    if (!description) return toast.error("설명을 입력해주세요");
    if (!isInternalPath(link)) {
      return toast.error('이동 경로는 "/jobs"처럼 앱 안의 경로만 넣을 수 있습니다');
    }
    if (!editingId && !file) return toast.error("배너 이미지를 선택해주세요");

    setSubmitting(true);
    try {
      const uploaded = file ? await uploadImage(file) : null;

      if (editingId) {
        const target = slides.find((s) => s.id === editingId);
        const patch: Record<string, unknown> = { title, description, link };
        if (uploaded) {
          patch.image_url = uploaded.url;
          patch.image_path = uploaded.path;
        }
        const { error } = await supabase
          .from("carousel_slides" as any)
          .update(patch as any)
          .eq("id", editingId);
        if (error) throw error;
        // 새 이미지로 교체했으면 예전 원본은 버킷에서 지운다.
        if (uploaded && target) await removeImage(target.image_path);
        toast.success("슬라이드를 수정했습니다");
      } else {
        // 새 슬라이드는 항상 맨 뒤에 붙인다.
        const nextOrder = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
        const { error } = await supabase.from("carousel_slides" as any).insert({
          title,
          description,
          link,
          image_url: uploaded!.url,
          image_path: uploaded!.path,
          sort_order: nextOrder,
          created_by: user?.id ?? null,
        } as any);
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
        supabase.from("carousel_slides" as any).update({ sort_order: i } as any).eq("id", s.id)
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
      .from("carousel_slides" as any)
      .update({ is_active: !s.is_active } as any)
      .eq("id", s.id);
    setBusyId(null);
    if (error) return toast.error("상태를 바꾸지 못했습니다");
    setSlides((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  };

  const remove = async (s: Slide) => {
    if (!confirm(`"${s.description}" 슬라이드를 삭제할까요?\n이미지 원본도 함께 지워집니다.`)) return;
    setBusyId(s.id);
    // 행을 먼저 지운다. 파일을 먼저 지우면 삭제가 중간에 끊겼을 때
    // 홈에 이미지 깨진 배너가 남는다.
    const { error } = await supabase.from("carousel_slides" as any).delete().eq("id", s.id);
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
              <Label>제목 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={40}
                placeholder="Find"
              />
              <p className="text-[11px] text-muted-foreground mt-1">배너 위에 작게 붙는 라벨입니다.</p>
            </div>
            <div>
              <Label>설명 *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={120}
                placeholder="믿을 수 있는 밴드·세션 멤버 찾기"
              />
            </div>
            <div>
              <Label>이동 경로 *</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                maxLength={200}
                placeholder="/jobs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                앱 안의 경로만 넣을 수 있습니다 (예: /jobs, /rooms, /community). 외부 주소는 저장되지 않습니다.
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
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground shrink-0">
                    {s.title}
                  </span>
                  {!s.is_active && (
                    <span className="px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-semibold shrink-0">
                      비활성
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm truncate mt-0.5">{s.description}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {i + 1}번째 · {s.link}
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
                onClick={() => remove(s)}
                disabled={busyId === s.id}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                삭제
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CarouselManager;
