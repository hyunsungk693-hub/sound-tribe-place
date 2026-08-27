import { useState } from "react";
import { Plus, X, Briefcase, Music2, Store, Users } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import CreatePostDialog from "./CreatePostDialog";

type PostType = "job" | "room" | "shop" | "community";

const jobFields = [
  { key: "title", label: "제목", placeholder: "예: 밴드 기타리스트 모집" },
  { key: "content", label: "상세 내용", placeholder: "구인 상세 내용을 작성해주세요", type: "textarea" as const },
  { key: "category", label: "카테고리", placeholder: "", type: "select" as const, options: ["공연", "녹음", "레슨", "행사", "기타"] },
  { key: "venue", label: "장소", placeholder: "장소를 검색해 선택하세요 (예: 홍대 라이브클럽)", type: "place" as const },
  { key: "pay", label: "급여/페이", placeholder: "예: 회당 15만원" },
  { key: "author_name", label: "작성자명", placeholder: "닉네임" },
];

const roomFields = [
  { key: "title", label: "연습실 이름", placeholder: "예: 사운드팩토리" },
  { key: "content", label: "상세 설명", placeholder: "연습실 소개를 작성해주세요", type: "textarea" as const },
  { key: "area", label: "위치", placeholder: "장소를 검색해 선택하세요 (예: 홍대입구역)", type: "place" as const },
  { key: "price", label: "가격", placeholder: "예: 시간당 1.5만원" },
  { key: "hours", label: "운영시간", placeholder: "예: 24시간" },
  { key: "instruments", label: "보유 장비 (쉼표 구분)", placeholder: "예: 드럼, 앰프, PA" },
  { key: "author_name", label: "작성자명", placeholder: "닉네임" },
];

const shopFields = [
  { key: "title", label: "악기사 이름", placeholder: "예: 뮤직랜드 홍대점" },
  { key: "content", label: "소개", placeholder: "취급 품목과 매장 소개를 작성해주세요", type: "textarea" as const },
  { key: "area", label: "위치/주소", placeholder: "장소를 검색해 선택하세요 (예: 서울 마포구 와우산로)", type: "place" as const },
  { key: "hours", label: "운영시간", placeholder: "예: 11:00 - 21:00" },
  { key: "instruments", label: "취급 악기 (쉼표 구분)", placeholder: "예: 기타, 베이스, 이펙터" },
  { key: "author_name", label: "작성자명", placeholder: "닉네임" },
];

const communityFields = [
  { key: "title", label: "제목", placeholder: "글 제목을 입력해주세요" },
  { key: "content", label: "내용", placeholder: "내용을 작성해주세요", type: "textarea" as const },
  { key: "category", label: "카테고리", placeholder: "", type: "select" as const, options: ["자유", "질문", "거래"] },
  { key: "author_name", label: "닉네임", placeholder: "닉네임" },
];

const TYPE_CONFIG: Record<PostType, { label: string; desc: string; icon: typeof Briefcase; fields: typeof jobFields; color: string }> = {
  job: { label: "구인구직", desc: "공연·녹음·레슨 모집", icon: Briefcase, fields: jobFields, color: "bg-blue-500/10 text-blue-600" },
  room: { label: "연습실", desc: "합주·개인 연습실 등록", icon: Music2, fields: roomFields, color: "bg-green-500/10 text-green-600" },
  shop: { label: "악기사", desc: "악기·장비 매장 등록", icon: Store, fields: shopFields, color: "bg-orange-500/10 text-orange-600" },
  community: { label: "커뮤니티", desc: "자유 글·질문·거래", icon: Users, fields: communityFields, color: "bg-purple-500/10 text-purple-600" },
};

const CreatePostFab = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [selected, setSelected] = useState<PostType | null>(null);

  if (!user) return null;
  const hideOn = ["/", "/messages", "/map", "/profile", "/auth", "/admin"];
  if (hideOn.some((p) => location.pathname === p || (p !== "/" && location.pathname.startsWith(p + "/")))) return null;

  const handlePick = (t: PostType) => {
    setChooserOpen(false);
    setSelected(t);
  };

  return (
    <>
      <div className="sticky bottom-[72px] z-[1990] h-0 max-w-lg w-full mx-auto flex justify-end pr-4 pointer-events-none">
        <button
          onClick={() => setChooserOpen(true)}
          aria-label="게시물 작성"
          className="pointer-events-auto -translate-y-12 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {chooserOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40"
          onClick={() => setChooserOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-background rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">어떤 게시물을 작성할까요?</h2>
              <button onClick={() => setChooserOpen(false)} className="p-1 rounded-full hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(TYPE_CONFIG) as PostType[]).map((t) => {
                const cfg = TYPE_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <button
                    key={t}
                    onClick={() => handlePick(t)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-secondary/50 transition-all text-left active:scale-95"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{cfg.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CreatePostDialog
          postType={selected}
          fields={TYPE_CONFIG[selected].fields}
          open={true}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          onCreated={() => {
            setSelected(null);
            window.dispatchEvent(new CustomEvent("post-created", { detail: { type: selected } }));
          }}
          hideButton
        />
      )}
    </>
  );
};

export default CreatePostFab;
