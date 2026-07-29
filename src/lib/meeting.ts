import type { AgendaDecisionMode, AgendaResponseType, AgendaStance } from '../types/database'

export const RESPONSE_TYPE_LABEL: Record<AgendaResponseType, string> = {
  vote: '찬반 투표',
  discussion: '서술형 의견',
}

export const DECISION_MODE_LABEL: Record<AgendaDecisionMode, string> = {
  app: '앱에서 종합',
  offline: '대면회의에서 결정',
}

export const STANCE_LABEL: Record<AgendaStance, string> = {
  for: '찬성',
  against: '반대',
  abstain: '기권',
}
