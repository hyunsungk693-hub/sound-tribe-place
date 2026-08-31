import { useState, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PlaceSearchInput from "@/components/PlaceSearchInput";

/** 급구 허용 기간 — DB 트리거(enforce_urgent_deadline)와 같은 값을 쓴다 */
const URGENT_MAX_DAYS = 3;

/**
 * 지원 자격 선택지. select는 라벨을 그대로 값으로 쓰므로 저장 직전에 DB 값으로 바꾼다
 * (posts.applicant_level CHECK: any | pro). 라벨을 여기서만 정의해 폼과 어긋나지 않게 한다.
 */
export const APPLICANT_LEVEL_ANY = "누구나 지원 가능";
export const APPLICANT_LEVEL_PRO = "인증된 프로만";

/** datetime-local 입력용 로컬 시각 문자열 (YYYY-MM-DDTHH:mm) */
const localDateTime = (daysFromNow: number) => {
  const d = new Date(Date.now() + daysFromNow * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export interface Field {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "select" | "location" | "place" | "checkbox" | "datetime" | "number";
  /** number 전용 범위 — DB CHECK와 같은 값을 쓴다 */
  min?: number;
  max?: number;
  options?: string[];
  required?: boolean;
  /** 다른 필드 값에 따라 조건부로 노출 (예: 카테고리가 "종교"일 때만) */
  showIf?: (values: Record<string, string>) => boolean;
}

interface CreatePostDialogProps {
  postType: string;
  fields: Field[];
  onCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideButton?: boolean;
}

const CreatePostDialog = ({ postType, fields, onCreated, open: openProp, onOpenChange, hideButton }: CreatePostDialogProps) => {
  const { user } = useAuth();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => { if (onOpenChange) onOpenChange(v); else setOpenState(v); };
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleFields = fields.filter((f) => !f.showIf || f.showIf(values));

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 첨부할 수 있습니다");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지 크기는 5MB 이하여야 합니다");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, imageFile);
    if (error) throw error;
    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!values.title?.trim() || !values.content?.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    // 필드별 필수 검증 (required 표시된 필드만 — 유형별 정책은 fields 정의가 결정)
    // 조건부로 숨겨진 필드는 검증 대상에서 제외한다
    const missing = visibleFields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) {
      toast.error(`${missing.label}을(를) 입력해주세요`);
      return;
    }

    // 급구는 마감까지 3일 이하인 공고만 (DB 트리거와 동일한 규칙)
    if (values.is_urgent === "true") {
      const dl = values.deadline_at ? new Date(values.deadline_at).getTime() : NaN;
      if (!dl || Number.isNaN(dl)) {
        toast.error("급구 공고는 마감일시를 입력해주세요");
        return;
      }
      if (dl <= Date.now()) {
        toast.error("마감일시가 이미 지났습니다");
        return;
      }
      if (dl > Date.now() + URGENT_MAX_DAYS * 86400000) {
        toast.error(`급구는 마감까지 ${URGENT_MAX_DAYS}일 이하인 공고만 등록할 수 있습니다`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const postData: Record<string, unknown> = {
        user_id: user.id,
        post_type: postType,
        title: values.title.trim(),
        content: values.content.trim(),
        author_name: values.author_name?.trim() || user.email?.split("@")[0] || "익명",
      };

      if (imageUrl) postData.image_url = imageUrl;
      if (values.category) postData.category = values.category;
      // 하위 유형은 해당 카테고리가 선택된 경우에만 저장 (DB CHECK와 일치)
      if (values.category === "종교" && values.subcategory) postData.subcategory = values.subcategory;
      if (values.position) postData.position = values.position;
      if (values.headcount) {
        const n = parseInt(values.headcount, 10);
        if (Number.isFinite(n)) postData.headcount = n;
      }
      if (values.applicant_level) {
        postData.applicant_level = values.applicant_level === APPLICANT_LEVEL_PRO ? "pro" : "any";
      }
      if (values.phone) postData.phone = values.phone.trim();
      if (values.schedule) postData.schedule = values.schedule;
      if (values.is_urgent === "true") postData.is_urgent = true;
      if (values.deadline_at) postData.deadline_at = new Date(values.deadline_at).toISOString();
      if (values.venue) postData.venue = values.venue;
      if (values.pay) postData.pay = values.pay;
      if (values.price) postData.price = values.price;
      if (values.area) postData.area = values.area;
      if (values.hours) postData.hours = values.hours;
      if (values.instruments) postData.instruments = values.instruments.split(",").map((s: string) => s.trim()).filter(Boolean);
      if (values.lat && values.lng) {
        postData.lat = parseFloat(values.lat);
        postData.lng = parseFloat(values.lng);
      }

      const { error } = await supabase.from("posts").insert(postData as any);
      if (error) throw error;

      track("post_create", { post_type: postType });
      toast.success("게시물이 등록되었습니다!");
      setValues({});
      removeImage();
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error("등록에 실패했습니다: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 작성 버튼은 CreatePostFab(우측 하단 플로팅)이 전담한다
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end lg:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl lg:rounded-2xl p-5 pb-8 max-h-sheet overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">게시물 작성</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {visibleFields.map((field) => (
            <div key={field.key}>
              {field.type !== "checkbox" && (
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
              )}
              {field.type === "number" ? (
                <input
                  type="number"
                  inputMode="numeric"
                  min={field.min ?? 1}
                  max={field.max ?? 99}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={values[field.key] === "true"}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.checked ? "true" : "" }))}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{field.placeholder}</span>
                </label>
              ) : field.type === "datetime" ? (
                <Input
                  type="datetime-local"
                  value={values[field.key] || ""}
                  min={localDateTime(0)}
                  max={localDateTime(URGENT_MAX_DAYS)}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="text-sm"
                />
              ) : field.type === "textarea" ? (
                <Textarea
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="text-sm"
                  rows={4}
                />
              ) : field.type === "select" && field.options ? (
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">선택해주세요</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === "place" ? (
                <PlaceSearchInput
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  selected={Boolean(values.lat && values.lng)}
                  onChange={(v) =>
                    setValues((prev) => {
                      const next = { ...prev, [field.key]: v };
                      delete next.lat;
                      delete next.lng;
                      return next;
                    })
                  }
                  onSelect={({ name, lat, lng }) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: name,
                      lat: String(lat),
                      lng: String(lng),
                    }))
                  }
                />
              ) : field.type === "location" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="위도 (예: 37.5563)" value={values.lat || ""} onChange={(e) => setValues((prev) => ({ ...prev, lat: e.target.value }))} className="text-sm" />
                    <Input placeholder="경도 (예: 126.9236)" value={values.lng || ""} onChange={(e) => setValues((prev) => ({ ...prev, lng: e.target.value }))} className="text-sm" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.geolocation?.getCurrentPosition((pos) => {
                        setValues((prev) => ({
                          ...prev,
                          lat: pos.coords.latitude.toFixed(4),
                          lng: pos.coords.longitude.toFixed(4),
                        }));
                      }, () => toast.error("위치를 가져올 수 없습니다"));
                    }}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    📍 현재 위치 사용
                  </button>
                </div>
              ) : (
                <Input
                  placeholder={field.placeholder}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="text-sm"
                />
              )}
            </div>
          ))}

          {/* Image Upload */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">이미지 첨부</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={imagePreview} alt="미리보기" className="w-full max-h-48 object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground"
              >
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm">이미지 추가 (최대 5MB)</span>
              </button>
            )}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-5"
        >
          {submitting ? "등록 중..." : "등록하기"}
        </Button>
      </div>
    </div>
  );
};

export default CreatePostDialog;
