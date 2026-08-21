import type { Profile } from '../types/database'

/**
 * 화면에 보여줄 이름.
 * profiles가 아직 없거나 못 읽는 경우를 대비해 UUID 앞자리로 떨어진다.
 */
export function profileLabel(
  profile: Profile | undefined,
  userId: string,
  myUserId?: string,
): string {
  if (myUserId && userId === myUserId) return '나'
  const name = profile?.display_name?.trim()
  if (name) return name
  const email = profile?.email?.trim()
  if (email) return email.split('@')[0]
  return userId.slice(0, 6)
}
