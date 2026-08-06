import { useState } from 'react';

const ROLES = [
  { id: 'guest', label: 'Guest', icon: '🧳', desc: 'Browse and book properties' },
  { id: 'host',  label: 'Host',  icon: '🏠', desc: 'List and manage properties' },
];

export default function RegisterPage({ setCurrentPage, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'guest',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     formData.name,
          email:    formData.email,
          password: formData.password,
          role:     formData.role,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(`✅ Account created! Welcome to StayKenya, ${formData.name}.`);
        onSuccess();
      } else {
        setError(data.message || 'Registration failed. Please try again.');
      }
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-600 tracking-tight">StayKenya</h1>
          <p className="text-gray-500 mt-2">Create your account to get started</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                I want to…
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, role: r.id })}
                    className={`p-4 rounded-2xl border-2 text-left transition ${
                      formData.role === r.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{r.icon}</span>
                    <span className="font-semibold text-sm block">{r.label}</span>
                    <span className="text-xs text-gray-400">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Wanjiku"
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 transition"
                value={formData.name}
                onChange={set('name')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 transition"
                value={formData.email}
                onChange={set('email')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 transition"
                value={formData.password}
                onChange={set('password')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Repeat password"
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-red-400 transition"
                value={formData.confirmPassword}
                onChange={set('confirmPassword')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-red-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <span
              className="text-red-600 font-semibold cursor-pointer hover:underline"
              onClick={() => setCurrentPage('login')}
            >
              Sign in
            </span>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 StayKenya ·
        </p>
      </div>
    </div>
  );
}
