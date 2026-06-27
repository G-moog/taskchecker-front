import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useFcmToken } from './hooks/useFcmToken'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import CheckPage from './pages/CheckPage'
import EditPage from './pages/EditPage'
import JoinTeamPage from './pages/JoinTeamPage'
import TeamSettingsPage from './pages/TeamSettingsPage'
import MyPage from './pages/MyPage'

function AppRoutes() {
  const { user, loading } = useAuth()
  useFcmToken(user?.id)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        로딩 중...
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/checklist/:id" element={<CheckPage />} />
      <Route path="/checklist/new/edit" element={<EditPage />} />
      <Route path="/checklist/:id/edit" element={<EditPage />} />
      <Route path="/join-team" element={<JoinTeamPage />} />
      <Route path="/team/:teamId/settings" element={<TeamSettingsPage />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
