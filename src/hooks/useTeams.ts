import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Team, TeamMember } from '../types/database'

export interface TeamWithRole extends Team {
  role: TeamMember['role']
}

export function useTeams(userId: string | undefined) {
  const [teams, setTeams] = useState<TeamWithRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setTeams([])
      setLoading(false)
      return
    }

    const fetch = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('team_members')
        .select('role, teams(id, name, created_by, created_at)')
        .eq('user_id', userId)

      if (!error && data) {
        const result = data
          .filter((row) => row.teams)
          .map((row) => ({ ...(row.teams as unknown as Team), role: row.role }))
        setTeams(result)
      }
      setLoading(false)
    }

    fetch()
  }, [userId])

  const createTeam = async (name: string) => {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name, created_by: userId! })
      .select()
      .single()
    if (!error && data) {
      await supabase.from('team_members').insert({
        team_id: data.id,
        user_id: userId!,
        role: 'admin',
      })
      setTeams((prev) => [...prev, { ...data, role: 'admin' }])
    }
    return { data, error }
  }

  return { teams, loading, createTeam }
}
