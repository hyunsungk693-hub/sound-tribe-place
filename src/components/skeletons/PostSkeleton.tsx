import { Skeleton } from "@/components/ui/skeleton";

export const PostCardSkeleton = () => (
  <div className="glass-card p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Skeleton className="w-7 h-7 rounded-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-12" />
      <Skeleton className="ml-auto h-4 w-10 rounded-full" />
    </div>
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-2/3" />
    <div className="flex items-center gap-4 pt-3 border-t border-border/30">
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-3 w-10" />
    </div>
  </div>
);

export const JobCardSkeleton = () => (
  <div className="glass-card p-4 space-y-2">
    <div className="flex items-start justify-between">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
    <Skeleton className="h-3 w-1/3" />
    <div className="flex items-center justify-between pt-3 border-t border-border/30">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-14" />
    </div>
  </div>
);

// 연습실·악기사 목록은 모바일에서 리스트(썸네일 + 정보), lg 이상에서 카드 그리드다.
// 스켈레톤도 같은 모양이어야 로딩이 끝나는 순간 레이아웃이 튀지 않는다.
export const RoomCardSkeleton = () => (
  <div className="flex gap-3 py-3 lg:block lg:gap-0 lg:py-0 lg:glass-card lg:p-4 lg:space-y-3">
    <Skeleton className="w-20 h-20 shrink-0 rounded-lg lg:w-full lg:h-36" />
    <div className="min-w-0 flex-1 space-y-2 lg:space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="hidden lg:flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

export const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 p-4 rounded-xl">
    <Skeleton className="w-11 h-11 rounded-full shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
    <Skeleton className="h-3 w-10" />
  </div>
);

export const BannerSkeleton = () => (
  <div className="rounded-2xl overflow-hidden">
    <Skeleton className="w-full h-20" />
  </div>
);

export const HomeSkeleton = () => (
  <div className="space-y-6">
    <BannerSkeleton />
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card p-3.5 flex items-start gap-2">
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="glass-card p-3.5 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
