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

/** auth.users의 구글 프로필을 복사해 둔 것 — 화면에 이름을 보여주는 용도 */
export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  updated_at: string
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
  /** null이면 시트로 보내지 않는다 */
  sheet_target_id: string | null
  /** null이면 title을 탭 이름으로 쓴다 */
  sheet_tab_name: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  label: string
  sort_order: number
  todo_id: string | null
  item_type: 'check' | 'measure'
  unit: string | null
  options: string[] | null
  has_note: boolean
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
  value: string | null
  note: string | null
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
  team_id: string | null
  title: string
  done: boolean
  sort_order: number | null
  notify_at: string | null
  created_at: string
}

/** 구글 시트 연동 대상 — 스프레드시트 파일 하나 */
export interface SheetTarget {
  id: string
  owner_type: OwnerType
  owner_id: string
  name: string
  spreadsheet_id: string
  created_by: string
  created_at: string
}

export interface MeasurementForm {
  id: string
  title: string
  owner_type: OwnerType
  owner_id: string
  notify_weekday: number | null
  notify_time: string | null
  /** null이면 시트로 보내지 않는다 */
  sheet_target_id: string | null
  /** null이면 title을 탭 이름으로 쓴다 */
  sheet_tab_name: string | null
  created_by: string
  created_at: string
}

export interface MeasurementField {
  id: string
  form_id: string
  label: string
  unit: string | null
  sort_order: number
}

export interface MeasurementEntry {
  id: string
  form_id: string
  submitted_at: string
  submitted_by: string
}

export interface MeasurementValue {
  id: string
  entry_id: string
  field_id: string
  value: string
}

/** 'vote' = 찬성/반대/기권 + 이유(선택), 'discussion' = 서술형 의견만 */
export type AgendaResponseType = 'vote' | 'discussion'
/** 'app' = 앱에서 의견 종합해 마무리, 'offline' = 대면회의에서 최종 결정 */
export type AgendaDecisionMode = 'app' | 'offline'
export type AgendaStance = 'for' | 'against' | 'abstain'

export interface MeetingAgenda {
  id: string
  team_id: string
  title: string
  body: string | null
  response_type: AgendaResponseType
  decision_mode: AgendaDecisionMode
  created_by: string
  created_at: string
  updated_at: string
}

export interface MeetingResponse {
  id: string
  agenda_id: string
  user_id: string
  stance: AgendaStance | null
  comment: string | null
  created_at: string
  updated_at: string
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
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
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
      sheet_targets: {
        Row: SheetTarget
        Insert: Omit<SheetTarget, 'id' | 'created_at'>
        Update: Partial<Omit<SheetTarget, 'id'>>
        Relationships: []
      }
      meeting_agendas: {
        Row: MeetingAgenda
        Insert: Omit<MeetingAgenda, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MeetingAgenda, 'id'>>
        Relationships: []
      }
      meeting_responses: {
        Row: MeetingResponse
        Insert: Omit<MeetingResponse, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MeetingResponse, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
