import { Link } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SUPPORT_EMAIL } from "@/lib/support";

// 개인정보처리방침.
//
// 이 라우트는 App.tsx에서 ProtectedRoute 밖에 있다 — 가입을 고민하는 사람이 무엇을
// 내주게 되는지 먼저 읽을 수 있어야 하기 때문이다. 그래서 이 파일은 로그인하지 않은
// 사람이 읽는다고 가정하고 쓴다(PageShell은 PublicProfile이 이미 비로그인으로 쓰고 있고,
// TopNav·BottomNav·FAB 모두 user가 없을 때를 스스로 처리한다).
//
// 작성 원칙은 Profile.tsx의 '개인정보 보호' · '약관 및 정책' 다이얼로그와 같다 —
// 코드가 실제로 하는 일만 적는다. 인터넷의 표준 방침 문구를 옮겨 적으면 "우리는 이렇게
// 합니다"라고 약속한 것이 되는데, 그 약속을 지키는 코드가 없으면 그 문장 자체가 거짓이다.
// 방침은 지키지 못할 때 위험해지지, 비어 있을 때 위험해지는 것이 아니다. 그래서 확인하지
// 못한 것은 지어내지 않고 §7에 "아직 비어 있다"고 그대로 적었다.
//
// 아래 모든 항목은 supabase/migrations/*.sql, src/lib/analytics.ts, src/lib/push.ts,
// src/lib/recentViews.ts, src/hooks/useLastSeen.ts, index.html에서 직접 확인한 것이다.

// 문서 하단의 시행일과 개정 이력. 문장 안에 날짜를 흩어 두면 고칠 때 한 곳을 반드시 놓친다.
const EFFECTIVE_DATE = "2026년 9월 4일";
const REVISION_NOTE = "최초 작성. 이전 개정 이력 없음.";

// 목차. 긴 문서라 "내가 궁금한 건 어디 있나"를 먼저 보여준다.
// 앵커 대상에는 scroll-mt를 준다 — PageShell의 헤더가 sticky라 그냥 뛰면 제목이 그 아래 가린다.
const SECTIONS = [
  { id: "collect", no: "01", title: "무엇을 수집하는가" },
  { id: "visibility", no: "02", title: "무엇이 누구에게 보이는가" },
  { id: "retention", no: "03", title: "얼마나 보관하는가" },
  { id: "processors", no: "04", title: "누구에게 맡기는가 (국외 이전 포함)" },
  { id: "safeguards", no: "05", title: "어떻게 보호하는가" },
  { id: "rights", no: "06", title: "권리와 행사 방법" },
  { id: "gaps", no: "07", title: "아직 비어 있는 항목" },
  { id: "contact", no: "08", title: "문의처" },
] as const;

const Section = ({
  id,
  no,
  title,
  children,
}: {
  id: string;
  no: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-baseline gap-2.5 border-b border-border pb-2 mb-3.5">
      <span className="mono-label">{no}</span>
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

// 평면 카드 + 헤어라인 테두리(.glass-card와 같은 규칙). 그림자는 쓰지 않는다.
const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-3.5">
    <p className="mono-label mb-1.5">{label}</p>
    <div className="text-sm leading-relaxed text-muted-foreground space-y-2">{children}</div>
  </div>
);

const Para = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
);

const Bullets = ({ children }: { children: React.ReactNode }) => (
  <ul className="text-sm leading-relaxed text-muted-foreground space-y-1.5 list-disc pl-4">{children}</ul>
);

// 문장 한가운데서 강조할 때. 파스텔 배경 위 본문색이라 색이 아니라 굵기로만 구분한다.
const Em = ({ children }: { children: React.ReactNode }) => (
  <span className="text-foreground font-medium">{children}</span>
);

const Privacy = () => {
  useDocumentTitle("개인정보처리방침");

  return (
    <PageShell title="개인정보처리방침">
      <div className="space-y-8 pb-4">
        {/* 맨 위 고지. 이 문서가 무엇이 아닌지를 먼저 밝히지 않으면, 읽는 사람은 검토를 마친
            법률 문서로 받아들인다. 그 오인 자체가 실제 위험이다 — Profile.tsx의 '약관 및 정책'
            다이얼로그가 같은 이유로 같은 자리에 같은 고지를 두고 있다. */}
        <div className="rounded-lg border border-amber/40 bg-amber/5 p-4">
          <p className="font-semibold text-amber text-sm">법률 검토를 받지 않은 초안입니다</p>
          <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">
            이 문서는 INSTRUT의 코드와 데이터베이스 정의를 직접 읽고, 실제로 저장되거나
            바깥으로 나가는 것만 적은 초안입니다. 변호사 검토를 받지 않았고, 개인정보 보호법이
            요구하는 형식을 아직 다 갖추지도 못했습니다 — 무엇이 비어 있는지는 아래{" "}
            <a href="#gaps" className="text-foreground underline underline-offset-4">
              07 · 아직 비어 있는 항목
            </a>
            에 그대로 적어 두었습니다. 관행적인 방침 문구를 옮겨 적지 않았으므로,{" "}
            <Em>여기에 적히지 않은 것은 &lsquo;아직 정해지지 않았다&rsquo;는 뜻</Em>입니다.
          </p>
        </div>

        {/* 목차 */}
        <nav aria-label="목차" className="rounded-lg border border-border bg-card p-3.5">
          <p className="mono-label mb-2.5">Contents</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {SECTIONS.map((s) => (
              <li key={s.id} className="flex items-baseline gap-2 text-sm">
                <span className="mono-label shrink-0">{s.no}</span>
                <a
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="collect" no="01" title="무엇을 수집하는가">
          <Para>
            아래가 전부입니다. 주민등록번호 · 결제수단 · 위치추적 · 연락처 목록 · 기기 식별자는
            받지도, 저장하지도 않습니다. 제휴 연습실 예약에 금액이 표시되지만{" "}
            <Em>현재 실제 결제는 이뤄지지 않으므로</Em> 카드번호나 계좌번호를 받는 화면은 없습니다.
          </Para>

          <Item label="가입할 때">
            <p>
              이메일과 비밀번호, 그리고 가입 폼에 적은 이름. 계정과 비밀번호는 인증 서비스(Supabase Auth)가
              보관하며, 비밀번호는 해시된 형태로만 저장되고 앱 코드는 원문을 다루지 않습니다.
              적은 이름은 프로필의 표시 이름 초깃값이 됩니다 — 이름을 비운 채 가입하면{" "}
              <Em>이메일의 @ 앞부분</Em>이 표시 이름이 되므로(도메인은 쓰지 않습니다),
              본명이나 이메일이 드러나길 원하지 않는다면 가입 후 프로필 수정에서 바꾸세요.
              이메일 자체는 프로필에 저장되지 않고 다른 이용자에게 보이지 않습니다.
            </p>
          </Item>

          <Item label="프로필에 직접 적는 것">
            <p>
              표시 이름 · 지역 · 다루는 악기 · 장르 · 소개글 · 프로필 사진 · 연주영상 링크
              (YouTube · Instagram 주소만 저장할 수 있습니다) · 활동 목적(취미 / 프로) ·
              합주 가능 시간대 · 핸들(@). 모두 직접 적는 값이고, 언제든 지우거나 비울 수 있습니다.
              핸들을 정하면 <Em>로그인 없이 열람할 수 있는 소개 카드 주소</Em>가 만들어집니다.
            </p>
          </Item>

          <Item label="활동하면서 쌓이는 것">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                게시물 — 제목 · 내용 · 유형 · 지역 · 급여나 이용료 · 시간 · 모집 악기 · 인원 ·
                포지션 · 마감일시 · 첨부 이미지. 연습실 · 악기사 글에는 주소 검색으로 고른 좌표와
                매장 전화번호가 함께 저장됩니다.
              </li>
              <li>좋아요 · 댓글, 그리고 그로 인해 상대에게 가는 알림(행위자 이름 · 글 제목).</li>
              <li>구인 지원 — 지원서에 쓴 내용, 처리 상태, 공고 작성자가 처음 응답한 시각.</li>
              <li>메시지 — 대화 상대, 본문, 읽음 여부, 첨부한 파일의 이름 · 종류.</li>
              <li>
                예약 — 무료 연습실은 예약한 시간대와 메모, 취소하면 사유(1~500자) · 시간대 ·
                누가 취소했는지. 제휴 연습실은 예약 시간대 · 금액 · 상태(대기 / 확정 / 취소 /
                이용 완료 / 노쇼).
              </li>
              <li>
                합주 후기 — 약속 지킴 · 실력 일치 · 또 하고 싶음 세 항목의 예/아니오, 그리고
                후기를 신고했다면 그 사유.
              </li>
              <li>
                위 기록에서 계산되는 값 — 응답률 · 중앙 응답시간 · 함께한 횟수 · 파트너 수 ·
                재섭외율 · 노쇼 횟수 · 신뢰 등급 · 긍정률.
              </li>
              <li>연습실 · 악기사를 등록한 경우 업소 이름 · 주소 · 좌표 · 전화 · 설명 · 방과 시간대.</li>
            </ul>
          </Item>

          <Item label="올리는 파일">
            <p>
              프로필 사진과 게시물 이미지는 <Em>누구나 열 수 있는 저장소</Em>에 올라갑니다.
              메시지에 붙인 파일은 비공개 저장소에 올라가 그 대화의 두 사람만 열 수 있습니다.
              증빙 서류(졸업 · 재학 · 수상)는 별도의 비공개 저장소에 올라가 본인과 관리자만
              열 수 있고, 열 때마다 한시적으로 발급되는 주소를 씁니다. 자동 판독은 하지 않고
              사람이 직접 확인하며, 확인이 끝나면 원본은 파기됩니다(§3).
            </p>
          </Item>

          <Item label="자동으로 기록되는 것">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                접속 상태 — 앱 탭이 화면에 보이는 동안 마지막 접속 시각이 <Em>2분 간격</Em>으로
                기록되고, 그 값이 5분 이내이면 프로필에 &lsquo;활동 중&rsquo;으로 표시됩니다.
                시각 자체는 어디에도 표시하지 않습니다. 프로필 수정에서 접속 상태 숨기기를 켜면
                화면에서 가리는 것이 아니라 <Em>기록을 남기는 일 자체를 멈추고</Em>, 켜는 순간
                남아 있던 값도 비웁니다.
              </li>
              <li>
                알림을 켰을 때 — 알림을 보낼 주소(브라우저가 발급)와 암호화 키, 그리고 어떤
                브라우저인지(User-Agent). 알림을 끄면 그 자리에서 삭제됩니다.
              </li>
              <li>
                사용 지표 — 어떤 화면을 보고 언제 떠나는지, 그리고 가입 · 글 작성 · 지원 ·
                대화 시작 네 가지 동작. 글 작성 시 함께 보내는 값은 게시물 유형뿐입니다.
                게시물 내용 · 메시지 본문 · 이메일 · 계정 식별자는 보내지 않습니다.
              </li>
              <li>
                오류 기록 — 화면이 흰 채로 멈추는 오류가 나면 오류 메시지 · 스택 · 그때의 경로를
                남깁니다. 입력하던 값이 딸려 나가지 않도록 화면에 있던 내용은 보내지 않습니다.
              </li>
            </ul>
          </Item>

          <Item label="이 기기에만 남는 것">
            <p>
              &lsquo;최근 본&rsquo; 목록은 서버로 보내지 않고 이 브라우저에만 최대 20개까지
              저장됩니다. 브라우저 데이터를 지우면 함께 사라집니다.
            </p>
          </Item>
        </Section>

        <Section id="visibility" no="02" title="무엇이 누구에게 보이는가">
          <Item label="로그인하지 않아도 보이는 것">
            <p>
              게시물, 그리고 핸들을 정한 사람의 소개 카드. 검색엔진이 읽어갈 수 있도록 게시물 목록은
              사이트맵에도 실립니다. 활동 목적을 &lsquo;프로&rsquo;로 두고 아직 증빙 인증을 받지
              않았다면 프로필은 본인과 관리자에게만 보입니다.
            </p>
          </Item>
          <Item label="로그인한 이용자에게 보이는 것">
            <p>
              프로필에 적은 내용 전부와 신뢰 등급 · 배지 · 접속 상태. 무료 연습실 예약은 어느
              시간대가 찼는지 알아야 예약이 되므로 열려 있습니다 — 화면에는 시간대만 보이지만{" "}
              <Em>예약한 사람의 식별자도 함께 공개됩니다</Em>.
            </p>
          </Item>
          <Item label="당사자만 보는 것">
            <p>
              지원서 내용은 본인과 그 공고를 올린 사람만, 메시지와 첨부 파일은 대화 상대만,
              예약 취소 사유는 취소한 본인과 그 연습실을 올린 사람만 봅니다. 제휴 연습실을
              예약하면 그 업소를 등록한 사장님이 예약 시간 · 금액 · 상태를 봅니다.
            </p>
          </Item>
          <Item label="본인과 관리자만 보는 것">
            <p>
              증빙 서류 원본. 다른 이용자에게는 어떤 서류로 인증했는지 보이지 않고
              &lsquo;인증 완료&rsquo; 배지만 보입니다. 관리자는 문의 처리와 신고 검토를 위해
              위의 비공개 항목 일부를 볼 수 있습니다.
            </p>
          </Item>
        </Section>

        <Section id="retention" no="03" title="얼마나 보관하는가">
          <Para>
            코드가 스스로 지우는 것과, 사람이 지워야 지워지는 것을 나눠 적습니다.
            기한이 정해져 있지 않은 항목은 정해져 있지 않다고 적었습니다.
          </Para>
          <Item label="정해진 기한에 자동으로 파기되는 것">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                <Em>증빙 서류 원본 — 검증이 끝난 날(통과든 반려든)로부터 30일.</Em> 매일 한 번
                도는 작업이 원본을 지우고, 인증 종류 · 검증 일시 · 검증자 · 통과 여부만 남깁니다.
                파일 경로는 데이터베이스에 저장하지 않으므로 파기 후에는 되찾을 단서도 남지 않습니다.
              </li>
              <li>
                제휴 예약의 미완료 요청 — 결제 대기 5분, 사장님 승인 대기 24시간(합주 시작이 더
                빠르면 그때)이 지나면 자동 취소되고 시간대가 다시 열립니다.
              </li>
            </ul>
          </Item>
          <Item label="이용자가 지우면 그 즉시 사라지는 것">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>프로필 항목 — 프로필 수정에서 비우면 그 값이 지워집니다.</li>
              <li>게시물 — 지우면 딸린 좋아요 · 댓글 · 알림도 함께 사라집니다.</li>
              <li>지원 — 취소하면 지원서가 삭제되고 공고 작성자의 응답률 계산에서도 빠집니다.</li>
              <li>알림 구독 — 알림을 끄면 저장된 주소와 키가 삭제됩니다.</li>
              <li>접속 기록 — 접속 상태 숨기기를 켜면 남아 있던 값이 비워집니다.</li>
            </ul>
          </Item>
          <Item label="보관 기한이 정해져 있지 않은 것">
            <p>
              게시물 · 댓글 · 메시지와 첨부 파일 · 알림 · 무료 연습실 예약과 그 취소 사유 ·
              합주 후기와 그로부터 계산된 등급은 <Em>지우기 전까지 남습니다.</Em> 일정 기간이
              지나면 자동으로 지우는 장치는 아직 없습니다.
            </p>
          </Item>
          <Item label="계정을 지우면">
            <p>
              계정을 삭제하면 프로필 · 증빙 인증 기록 · 받은 평가와 등급 · 제휴 예약 ·
              등록한 업소는 함께 삭제됩니다. 다만 <Em>게시물 · 댓글 · 좋아요 · 메시지 · 알림 ·
              무료 연습실 예약 · 알림 구독은 계정과 함께 자동으로 지워지지 않습니다.</Em>{" "}
              이것들도 남기고 싶지 않다면 삭제를 요청하기 전에 직접 지우시거나, 요청할 때 함께
              지워달라고 알려 주세요.
            </p>
          </Item>
        </Section>

        <Section id="processors" no="04" title="누구에게 맡기는가 (국외 이전 포함)">
          <Para>
            INSTRUT은 개인정보를 팔거나 광고 목적으로 제3자에게 제공하지 않습니다. 다만 서비스를
            돌리기 위해 아래 사업자의 설비를 씁니다. 별도로 적지 않은 한{" "}
            <Em>서버가 어느 나라에 있는지는 각 사업자의 설정값</Em>이며, 확인하지 못한 것은 §7에
            적어 두었습니다.
          </Para>
          <Item label="데이터베이스 · 인증 · 파일 저장 — Supabase">
            <p>
              §1의 데이터베이스 항목과 파일 전부. 계정 · 게시물 · 메시지 · 예약 · 증빙이 모두 여기
              저장되고, 알림을 보내는 서버 함수도 여기서 돕니다.
            </p>
          </Item>
          <Item label="웹사이트 배포 — Vercel">
            <p>
              앱 화면과 사이트맵 · 공유용 이미지 생성 함수가 여기서 제공됩니다. 요청이 이 서비스를
              거치므로 접속 IP와 브라우저 정보가 전달됩니다.
            </p>
          </Item>
          <Item label="사용 지표 — PostHog (미국)">
            <p>
              §1의 &lsquo;사용 지표&rsquo;와 &lsquo;오류 기록&rsquo;이 미국에 있는 서버
              (us.i.posthog.com)로 전송됩니다. <Em>대한민국 밖으로 나가는 이전에 해당합니다.</Em>{" "}
              보내는 시점은 해당 화면을 보거나 동작을 할 때이고, 목적은 어느 기능이 실제로 쓰이는지
              확인하는 것입니다. 이용자 계정 식별자와 이메일은 함께 보내지 않습니다.
            </p>
          </Item>
          <Item label="화면을 그리는 동안 브라우저가 직접 접속하는 곳">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                Google Fonts — 글꼴 파일을 받는 동안 접속 IP와 브라우저 정보가 전달됩니다.
              </li>
              <li>
                OpenStreetMap Nominatim — 주소 · 장소 검색창에 입력한 <Em>검색어</Em>와 접속 IP가
                전달됩니다(연습실 · 악기사 등록, 업소 주소 입력에서만 씁니다).
              </li>
              <li>
                YouTube · Instagram — 프로필에 걸린 연주영상을 보는 순간 그 서비스에 요청이 갑니다.
              </li>
              <li>
                브라우저 제조사의 푸시 서버 — 알림을 켜면 그 브라우저(Chrome · Safari 등)가 정한
                주소로 알림이 전달됩니다. 이 주소는 브라우저가 발급하는 값입니다.
              </li>
            </ul>
          </Item>
        </Section>

        <Section id="safeguards" no="05" title="어떻게 보호하는가">
          <Bullets>
            <li>
              모든 테이블에 행 단위 접근 제어를 걸어, 볼 자격이 있는 사람의 요청에만 값이 나갑니다.
              화면에서 감추는 방식이 아니라 데이터베이스가 직접 막습니다.
            </li>
            <li>
              증빙 서류와 메시지 첨부는 비공개 저장소에 두고, 열 때마다 한시적으로 발급되는 주소로만
              접근합니다. 주소를 아는 것만으로는 열리지 않습니다.
            </li>
            <li>
              공고 작성자는 받은 지원서의 <Em>처리 상태만</Em> 바꿀 수 있습니다. 지원서 본문을 고칠
              권한은 데이터베이스 차원에서 회수돼 있습니다.
            </li>
            <li>
              증빙 서류는 자동 판독 없이 사람이 확인하고, 원본 파일의 경로를 데이터베이스에 남기지
              않습니다. 파기 후에 되찾을 수 있는 흔적을 만들지 않기 위해서입니다.
            </li>
            <li>
              프로필에 넣을 수 있는 영상 주소를 YouTube · Instagram로 제한해, 다른 이용자의 화면에서
              실행되는 주소가 저장되지 않도록 막습니다.
            </li>
          </Bullets>
        </Section>

        <Section id="rights" no="06" title="권리와 행사 방법">
          <Para>
            열람 · 정정 · 삭제 · 처리정지를 요청할 수 있습니다. 아래는{" "}
            <Em>지금 앱에서 실제로 되는 것</Em>과 사람이 처리해야 하는 것을 나눈 것입니다.
          </Para>
          <Item label="바로 할 수 있는 것">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>프로필의 모든 항목을 고치거나 비우기 — 프로필 &rsaquo; 프로필 수정</li>
              <li>접속 상태 기록 멈추기 — 프로필 수정 &rsaquo; 접속 상태 숨기기</li>
              <li>올린 게시물 삭제 — 프로필 &rsaquo; 내 게시물</li>
              <li>넣은 지원 취소(지원서 삭제) — 나의 INSTRUT &rsaquo; 지원현황</li>
              <li>예약 취소 — 나의 INSTRUT &rsaquo; 예약현황</li>
              <li>알림 구독 삭제 — 알림 끄기</li>
              <li>사실과 다른 평가 신고 — 프로필 &rsaquo; 받은 평가 (접수 즉시 등급 산정에서 제외)</li>
              <li>이 기기의 &lsquo;최근 본&rsquo; 기록 삭제 — 브라우저 데이터 삭제</li>
            </ul>
          </Item>
          <Item label="운영자에게 요청해야 하는 것">
            <p>
              <Em>계정 삭제는 앱에서 직접 하는 기능이 아직 없습니다.</Em> 프로필 &rsaquo; 고객센터에서
              운영자에게 메시지를 보내거나, 로그인이 막혀 메시지를 보낼 수 없다면 아래 메일 주소로
              요청하면 운영자가 확인 후 처리합니다. 계정과 함께 지워지지 않는 항목은 §3에 적어
              두었습니다. 그 밖의 열람 · 정정 · 처리정지 요청도 같은 창구로 받습니다.
            </p>
          </Item>
        </Section>

        <Section id="gaps" no="07" title="아직 비어 있는 항목">
          <Para>
            개인정보 보호법이 방침에 담기를 요구하지만 아직 정해지지 않아 <Em>쓰지 못한</Em>
            항목입니다. 그럴듯하게 채워 넣는 대신 비어 있다고 적습니다 — 채워 넣는 순간 그 문장이
            거짓말이 되기 때문입니다. 정식 공개 전에 확정해야 합니다.
          </Para>
          <Bullets>
            <li>개인정보처리자(사업자 또는 개인)의 상호 · 주소 · 대표자</li>
            <li>개인정보 보호책임자의 성명 · 직책 · 연락처</li>
            <li>
              데이터베이스와 파일이 실제로 저장되는 국가 — 국외 이전 고지에 필요하지만 저장소 코드만
              으로는 확정할 수 없어 비워 두었습니다(PostHog가 미국이라는 것만 §4에 확인해 적었습니다).
            </li>
            <li>만 14세 미만 아동에 대한 처리 방침 — 현재 가입 절차에 나이를 확인하는 단계가 없습니다.</li>
            <li>기한이 정해지지 않은 항목(§3)의 보관 기간과 파기 절차</li>
            <li>권리 행사 요청을 받은 뒤의 처리 기한</li>
            <li>권익침해 구제 방법(개인정보 분쟁조정위원회 등) 안내</li>
            <li>이 방침을 고칠 때 이용자에게 알리는 방법과 시점</li>
          </Bullets>
        </Section>

        <Section id="contact" no="08" title="문의처">
          <Para>
            개인정보에 관한 문의 · 열람 · 정정 · 삭제 · 처리정지 요청은 아래로 받습니다.
            로그인이 가능한 상태라면 프로필 &rsaquo; 고객센터에서 운영자에게 앱 안에서 바로 보낼
            수도 있습니다. 두 창구 모두 같은 사람이 읽습니다.
          </Para>
          <div className="rounded-lg border border-border bg-card p-3.5">
            <p className="mono-label mb-1.5">Email</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sm font-medium text-foreground underline underline-offset-4"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          {/* /profile은 ProtectedRoute 뒤에 있어 로그인하지 않은 사람이 누르면 로그인 화면으로
              튕긴다. 이 문서의 독자는 아직 계정이 없는 사람도 포함하므로, 링크를 걸되
              로그인이 필요하다는 사실을 문장 안에 미리 적어 헛걸음을 막는다. */}
          <Para>
            이미 계정이 있다면{" "}
            <Link to="/profile" className="text-foreground underline underline-offset-4">
              프로필
            </Link>{" "}
            화면의 &lsquo;개인정보 보호&rsquo;와 &lsquo;약관 및 정책&rsquo;에서 같은 내용을
            더 짧게 볼 수 있습니다(로그인 필요).
          </Para>
        </Section>

        <div className="border-t border-border pt-4 space-y-1">
          <p className="mono-label">Effective</p>
          <p className="text-sm text-muted-foreground">시행일 · {EFFECTIVE_DATE}</p>
          <p className="text-sm text-muted-foreground">최종 개정일 · {EFFECTIVE_DATE}</p>
          <p className="text-xs text-muted-foreground pt-1">{REVISION_NOTE}</p>
        </div>
      </div>
    </PageShell>
  );
};

export default Privacy;
