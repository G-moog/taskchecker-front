export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type RepeatType = 'daily' | 'weekly' | 'once'
export type OwnerType = 'personal' | 'team'
export type TeamRole = 'admin' | 'member'

export interface Team {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  joined_at: string
}

export interface TeamInviteCode {
  id: string
  team_id: string
  code: string
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
}

export interface Checklist {
  id: string
  title: string
  owner_type: OwnerType
  owner_id: string
  repeat_type: RepeatType
  repeat_days: number[] | null
  notify_time: string | null
  scheduled_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  label: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ChecklistItemStatus {
  id: string
  item_id: string
  checklist_id: string
  status_date: string
  is_checked: boolean
  checked_by: string | null
  checked_at: string | null
}

export interface ChecklistNotifyTarget {
  id: string
  checklist_id: string
  user_id: string
  added_by: string
  created_at: string
}

export interface Todo {
  id: string
  user_id: string
  title: string
  done: boolean
  created_at: string
}

export interface UserPushToken {
  id: string
  user_id: string
  fcm_token: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: Team
        Insert: Omit<Team, 'id' | 'created_at'>
        Update: Partial<Omit<Team, 'id'>>
        Relationships: []
      }
      team_members: {
        Row: TeamMember
        Insert: Omit<TeamMember, 'id' | 'joined_at'>
        Update: Partial<Omit<TeamMember, 'id'>>
        Relationships: []
      }
      team_invite_codes: {
        Row: TeamInviteCode
        Insert: Omit<TeamInviteCode, 'id' | 'created_at'>
        Update: Partial<Omit<TeamInviteCode, 'id'>>
        Relationships: []
      }
      checklists: {
        Row: Checklist
        Insert: Omit<Checklist, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Checklist, 'id'>>
        Relationships: []
      }
      checklist_items: {
        Row: ChecklistItem
        Insert: Omit<ChecklistItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ChecklistItem, 'id'>>
        Relationships: []
      }
      checklist_item_status: {
        Row: ChecklistItemStatus
        Insert: Omit<ChecklistItemStatus, 'id'>
        Update: Partial<Omit<ChecklistItemStatus, 'id'>>
        Relationships: []
      }
      checklist_notify_targets: {
        Row: ChecklistNotifyTarget
        Insert: Omit<ChecklistNotifyTarget, 'id' | 'created_at'>
        Update: Partial<Omit<ChecklistNotifyTarget, 'id'>>
        Relationships: []
      }
      user_push_tokens: {
        Row: UserPushToken
        Insert: Omit<UserPushToken, 'id' | 'updated_at'>
        Update: Partial<Omit<UserPushToken, 'id'>>
        Relationships: []
      }
      todos: {
        Row: Todo
        Insert: Omit<Todo, 'id' | 'created_at'>
        Update: Partial<Omit<Todo, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
