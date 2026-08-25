import { useState, useRef } from "react";
import { Plus, X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PlaceSearchInput from "@/components/PlaceSearchInput";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "select" | "location" | "place";
  options?: string[];
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

  if (!open) {
    if (hideButton) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="게시물 작성"
        className="absolute top-3 right-14 z-[2100] w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">게시물 작성</h2>
          <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.label}</label>
              {field.type === "textarea" ? (
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
