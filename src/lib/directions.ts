// 길찾기 딥링크 (API 키 불필요)
// 좌표가 있으면 네이버 지도 길찾기(대중교통), 없으면 장소명 검색으로 연다.
export function naverDirectionsUrl(name: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) {
    // 목적지 형식: {경도},{위도},{이름} — 네이버는 lng,lat 순서
    return `https://map.naver.com/p/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/transit`;
  }
  return `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
}

export function googleDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// 좌표가 있으면 좌표 기반, 없으면 이름/주소 검색 기반 링크
export function hasDirections(lat?: number | null, lng?: number | null, addressText?: string | null) {
  return (lat != null && lng != null) || !!addressText?.trim();
}
