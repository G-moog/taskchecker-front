import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, TeamMember } from '../types/database'

export interface TeamMemberWithProfile extends TeamMember {
  profile?: Profile
}

export function useTeamMembers(teamId: string | undefined) {
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) { setMembers([]); setLoading(false); return }

    const run = async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at')

      if (!rows?.length) { setMembers([]); setLoading(false); return }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', rows.map((r) => r.user_id))

      const byId: Record<string, Profile> = {}
      for (const p of profiles ?? []) byId[p.id] = p

      setMembers(rows.map((r) => ({ ...r, profile: byId[r.user_id] })))
      setLoading(false)
    }
    run()
  }, [teamId])

  return { members, loading }
}
