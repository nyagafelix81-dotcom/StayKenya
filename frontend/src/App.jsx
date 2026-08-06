import { useState, useEffect } from 'react'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage     from './pages/HomePage'

function App() {
  const [currentPage, setCurrentPage] = useState(null) // null = loading
  const [user, setUser]               = useState(null)

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        const parsed = JSON.parse(savedUser)
        // Make sure the saved object is valid and has required fields
        if (parsed && parsed.id && parsed.name) {
          setUser(parsed)
          setCurrentPage('home')
          return
        }
      }
    } catch {
      // Corrupted localStorage — wipe it
    }
    localStorage.clear()
    setCurrentPage('login')
  }, [])

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    setCurrentPage('home')
  }

  const handleLogout = () => {
    localStorage.clear()
    setUser(null)
    setCurrentPage('login')
  }

  // Show nothing while checking localStorage (avoids the flash)
  if (currentPage === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading StayKenya…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage === 'login' && (
        <LoginPage
          setCurrentPage={setCurrentPage}
          onSuccess={handleLoginSuccess}
        />
      )}
      {currentPage === 'register' && (
        <RegisterPage
          setCurrentPage={setCurrentPage}
          onSuccess={() => setCurrentPage('login')}
        />
      )}
      {currentPage === 'home' && user && (
        <HomePage user={user} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App