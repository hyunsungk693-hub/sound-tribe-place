interface PaperPlaneProps {
  className?: string;
  /** 접힌 날개(크리스)를 그릴지 — 작은 크기에서는 뭉개지므로 기본은 끔 */
  crease?: boolean;
}

/**
 * 종이비행기 픽토그램 — 면으로 채운(filled) 실루엣.
 *
 * flaticon의 참조 아이콘과 같은 계열의 형태를 직접 그린 것이다.
 * (에셋을 복제하면 출처 표기 의무가 붙으므로 패스를 새로 작성했다)
 *
 * 형태: 오른쪽 위를 향한 다트. 꼬리 가운데가 안쪽으로 파여(concave) 있어
 * 삼각형이 아니라 종이비행기로 읽힌다. 18~26px에서 이 노치가 형태를 결정한다.
 */
const PaperPlane = ({ className = "", crease = false }: PaperPlaneProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {/* 노즈(우상단) → 꼬리 위쪽 끝(좌) → 가운데 노치 → 꼬리 아래쪽 끝 */}
    <path d="M21.7 2.3 2.6 10.1a.55.55 0 0 0-.06 1l6.6 2.85 9.02-8.02-7.06 8.93 3.02 6.9a.55.55 0 0 0 1-.05L21.7 2.3Z" />
    {crease && <path d="M9.14 13.95 21.7 2.3l-8.58 12.4-3.98-.75Z" opacity="0.55" />}
  </svg>
);

export default PaperPlane;
