/**
 * 번들된 음원의 주소. 코퍼스에는 `audio/<해시>.m4a` 로 들어 있다.
 * `base: './'` 로 빌드하므로 BASE_URL 을 앞에 붙이면 루트에 올려도 하위 경로(/gosay/)에 올려도 같은 빌드가 돈다.
 */
export function audioUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}
