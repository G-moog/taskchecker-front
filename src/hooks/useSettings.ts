import { useState } from 'react'

export interface AppSettings {
  todoQuickTimes: number[]      // 분 단위: [5, 10, 30, 60]
  checklistQuickTimes: string[] // HH:MM: ['09:00', '12:00', '18:00', '21:00']
  snoozeTimes: number[]         // 분 단위: 알림 미루기 버튼
}

const DEFAULTS: AppSettings = {
  todoQuickTimes: [5, 10, 30, 60],
  checklistQuickTimes: ['09:00', '12:00', '18:00', '21:00'],
  snoozeTimes: [10, 30, 60],
}

const KEY = 'app_settings'

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function save(settings: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load)

  const update = (next: Partial<AppSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next }
      save(merged)
      return merged
    })
  }

  return { settings, update }
}
