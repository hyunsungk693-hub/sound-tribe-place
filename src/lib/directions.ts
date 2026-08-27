// 길찾기 딥링크 (API 키 불필요)
export function kakaoDirectionsUrl(name: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(name)}`;
}

export function googleDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// 좌표가 있으면 좌표 기반, 없으면 이름/주소 검색 기반 링크
export function hasDirections(lat?: number | null, lng?: number | null, addressText?: string | null) {
  return (lat != null && lng != null) || !!addressText?.trim();
}
