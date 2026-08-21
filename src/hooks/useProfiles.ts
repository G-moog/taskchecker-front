import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

/** user_id -> Profile. 같은 팀 사람만 읽을 수 있다 (RLS). */
export function useProfiles(userIds: (string | null | undefined)[]) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  // 배열 정체성이 매 렌더 바뀌므로 정렬된 키로 고정한다
  const key = useMemo(() => {
    const ids = Array.from(new Set(userIds.filter((u): u is string => !!u)))
    ids.sort()
    return ids.join(',')
  }, [userIds])

  useEffect(() => {
    if (!key) { setProfiles({}); return }
    const ids = key.split(',')

    const run = async () => {
      const { data } = await supabase.from('profiles').select('*').in('id', ids)
      const map: Record<string, Profile> = {}
      for (const p of data ?? []) map[p.id] = p
      setProfiles(map)
    }
    run()
  }, [key])

  return profiles
}
