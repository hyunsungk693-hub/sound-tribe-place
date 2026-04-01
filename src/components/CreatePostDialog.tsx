import { useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Field {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "textarea" | "select" | "location";
  options?: string[];
}

interface CreatePostDialogProps {
  postType: string;
  fields: Field[];
  onCreated?: () => void;
}

const CreatePostDialog = ({ postType, fields, onCreated }: CreatePostDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

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
      const postData: Record<string, unknown> = {
        user_id: user.id,
        post_type: postType,
        title: values.title.trim(),
        content: values.content.trim(),
        author_name: values.author_name?.trim() || user.email?.split("@")[0] || "익명",
      };

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

      toast.success("게시물이 등록되었습니다!");
      setValues({});
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error("등록에 실패했습니다: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all"
      >
        <Plus className="w-6 h-6" />
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
