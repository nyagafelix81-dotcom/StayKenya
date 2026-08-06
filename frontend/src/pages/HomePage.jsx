import { useState, useEffect } from 'react';

const uid      = (u)  => u?.id || u?._id;
const fmt      = (n)  => Number(n || 0).toLocaleString('en-KE');
const fmtDate  = (d)  => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
const isExpired= (co) => co && new Date(co) < new Date();
const today    = new Date().toISOString().split('T')[0];

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
};

const UNIT_TYPES   = ['Entire home', 'Private room', 'Shared room', 'Guest house'];
const CAT_ICONS    = { 'All': '🌍', 'Entire home': '🏡', 'Private room': '🛏️', 'Shared room': '🏘️', 'Guest house': '🏚️' };
const PAYMENT_OPS  = [
  { id: 'mpesa', label: 'M-Pesa',             icon: '📱', desc: 'Fast mobile money payment' },
  { id: 'card',  label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, Amex'   },
  { id: 'cash',  label: 'Cash on Arrival',     icon: '💵', desc: 'Pay when you check in'     },
];
const ROLE_BADGE = { admin: 'bg-purple-100 text-purple-700', host: 'bg-blue-100 text-blue-700', guest: 'bg-green-100 text-green-700' };

function Badge({ label, color }) {
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${color}`}>{label}</span>;
}

function StatusBadge({ status, checkOut }) {
  if (isExpired(checkOut)) return <Badge label="Expired" color="bg-gray-100 text-gray-500" />;
  const c = { confirmed: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700', cancelled: 'bg-red-50 text-red-500' };
  return <Badge label={status || 'pending'} color={c[status] || c.pending} />;
}

function PropertyCard({ property, onClick }) {
  const [liked, setLiked] = useState(false);
  const img = property.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80';
  return (
    <div className="group cursor-pointer" onClick={() => onClick(property)}>
      <div className="relative overflow-hidden rounded-2xl bg-gray-100" style={{ aspectRatio: '1' }}>
        <img src={img} alt={property.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <button
          onClick={e => { e.stopPropagation(); setLiked(!liked); }}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/40 transition"
        >
          <svg viewBox="0 0 32 32" className="w-5 h-5" style={{ fill: liked ? '#FF385C' : 'transparent', stroke: liked ? '#FF385C' : 'white', strokeWidth: 2.5 }}>
            <path d="M16 28S3 20.7 3 11.5A7.5 7.5 0 0116 7.1 7.5 7.5 0 0129 11.5C29 20.7 16 28 16 28z" />
          </svg>
        </button>
        <div className="absolute bottom-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            {CAT_ICONS[property.unitType]} {property.unitType}
          </span>
        </div>
      </div>
      <div className="pt-3 pb-1">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 flex-1 pr-2">{property.title}</h3>
        </div>
        <p className="text-gray-500 text-sm mt-0.5">📍 {property.location}</p>
        <p className="text-gray-400 text-xs mt-0.5">Up to {property.guests || 10} guests</p>
        <p className="mt-2 text-sm font-bold text-gray-900">
          KSh {fmt(property.price)} <span className="text-gray-400 font-normal text-xs">/ night</span>
        </p>
      </div>
    </div>
  );
}

export default function HomePage({ user, onLogout }) {
  const rawRole = user?.role || 'guest';
  const role    = rawRole === 'user' ? 'guest' : rawRole;

  const [properties,   setProperties]   = useState([]);
  const [myBookings,   setMyBookings]    = useState([]);
  const [myProperties, setMyProperties] = useState([]);
  const [allBookings,  setAllBookings]  = useState([]);
  const [allUsers,     setAllUsers]     = useState([]);
  const [hostBookings, setHostBookings] = useState([]);

  const defaultTab = role === 'admin' ? 'dashboard' : 'browse';
  const [activeTab,   setActiveTab]   = useState(defaultTab);
  const [searchTerm,  setSearchTerm]  = useState('');
  const [unitFilter,  setUnitFilter]  = useState('All');
  const [minPrice,    setMinPrice]    = useState('');
  const [maxPrice,    setMaxPrice]    = useState('');

  // Slide-in booking panel
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [panelOpen,        setPanelOpen]        = useState(false);

  // Add/edit modal
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  // Booking form state
  const [bookingGuests,  setBookingGuests]  = useState(1);
  const [checkInDate,    setCheckInDate]    = useState('');
  const [checkOutDate,   setCheckOutDate]   = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [bookingStep,    setBookingStep]    = useState('details');

  const blank = { title: '', description: '', price: '', location: '', guests: 10, unitType: 'Entire home', image: '' };
  const [newProp, setNewProp] = useState(blank);

  useEffect(() => {
    fetchProperties();
    if (role !== 'admin') { fetchMyBookings(); fetchMyProperties(); }
    if (role === 'host')  { fetchHostBookings(); }
    if (role === 'admin')  { fetchAllBookings(); fetchAllUsers(); }
  }, []);

  const fetchProperties = async () => {
    try { const r = await fetch('/api/properties'); const d = await r.json(); setProperties(Array.isArray(d) ? d : []); } catch { setProperties([]); }
  };
  const fetchMyBookings = async () => {
    try { const r = await authFetch('/api/bookings/my'); const d = await r.json(); setMyBookings(Array.isArray(d) ? d : []); } catch { setMyBookings([]); }
  };
  const fetchMyProperties = async () => {
    try { const r = await fetch('/api/properties'); const d = await r.json(); if (Array.isArray(d)) setMyProperties(d.filter(p => (p.host?._id || p.host)?.toString() === uid(user)?.toString())); } catch { setMyProperties([]); }
  };
  const fetchAllBookings = async () => {
    try { const r = await authFetch('/api/bookings'); const d = await r.json(); setAllBookings(Array.isArray(d) ? d : []); } catch { setAllBookings([]); }
  };
  const fetchAllUsers = async () => {
    try { const r = await authFetch('/api/admin/users'); const d = await r.json(); setAllUsers(Array.isArray(d) ? d : []); } catch { setAllUsers([]); }
  };
  const fetchHostBookings = async () => {
    try { const r = await authFetch('/api/bookings/host'); const d = await r.json(); setHostBookings(Array.isArray(d) ? d : []); } catch { setHostBookings([]); }
  };

  const nights     = (!checkInDate || !checkOutDate) ? 0 : Math.max(0, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / 86400000));
  const totalPrice = nights * (selectedProperty?.price || 0);

  const openPanel = (p) => {
    setSelectedProperty(p);
    setBookingGuests(1); setCheckInDate(''); setCheckOutDate('');
    setPaymentMethod(''); setBookingStep('details');
    setTimeout(() => setPanelOpen(true), 10);
  };
  const closePanel = () => {
    setPanelOpen(false);
    setTimeout(() => setSelectedProperty(null), 350);
  };

  const goToPayment = () => {
    if (!checkInDate || !checkOutDate) return alert('Please select your dates.');
    if (new Date(checkOutDate) <= new Date(checkInDate)) return alert('Check-out must be after check-in.');
    if (bookingGuests > (selectedProperty?.guests || 10)) return alert(`Max ${selectedProperty?.guests || 10} guests.`);
    setBookingStep('payment');
  };
  const goToConfirm = () => { if (!paymentMethod) return alert('Select a payment method.'); setBookingStep('confirm'); };

  const handleBook = async () => {
    try {
      const res  = await authFetch('/api/bookings', { method: 'POST', body: JSON.stringify({ property: selectedProperty._id, checkIn: new Date(checkInDate), checkOut: new Date(checkOutDate), guests: bookingGuests, paymentMethod, totalPrice }) });
      const json = await res.json();
      if (res.ok) { closePanel(); fetchMyBookings(); fetchHostBookings(); alert(`✅ Booking confirmed! Total: KSh ${fmt(totalPrice)}`); }
      else alert(`❌ ${json.message || 'Booking failed'}`);
    } catch (err) { alert(`❌ ${err.message}`); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
    try {
      const res = await authFetch('/api/auth/me', { method: 'DELETE' });
      if (res.ok) { alert('Your account has been deleted.'); onLogout(); }
      else { const j = await res.json(); alert(`❌ ${j.message}`); }
    } catch (err) { alert(`❌ ${err.message}`); }
  };

  const handleSaveProperty = async (e) => {
    e.preventDefault();
    const data = editingProperty || newProp;
    if (!data.title || !data.location || !data.price) return alert('Title, location and price are required.');
    try {
      const res  = await authFetch(editingProperty ? `/api/properties/${editingProperty._id}` : '/api/properties', { method: editingProperty ? 'PUT' : 'POST', body: JSON.stringify({ ...data, price: Number(data.price) }) });
      const json = await res.json();
      if (res.ok) { alert(editingProperty ? '✅ Updated!' : '✅ Property added!'); setShowAddModal(false); setEditingProperty(null); setNewProp(blank); fetchProperties(); fetchMyProperties(); }
      else alert(`❌ ${json.message || 'Could not save'}`);
    } catch (err) { alert(`❌ ${err.message}`); }
  };

  const handleDeleteProperty = async (id) => {
    if (!window.confirm('Delete this property?')) return;
    try { const r = await authFetch(`/api/properties/${id}`, { method: 'DELETE' }); if (r.ok) { fetchProperties(); fetchMyProperties(); } } catch {}
  };
  const handleDeleteUser = async (id) => {
    if (!window.confirm('Remove this user?')) return;
    try { await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' }); fetchAllUsers(); } catch {}
  };
  const handleCancelBooking = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try { const r = await authFetch(`/api/bookings/${id}`, { method: 'DELETE' }); if (r.ok) { fetchMyBookings(); fetchAllBookings(); } } catch {}
  };

  const filtered = properties.filter(p => {
    const s  = !searchTerm || p.location?.toLowerCase().includes(searchTerm.toLowerCase()) || p.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const t  = unitFilter === 'All' || p.unitType === unitFilter;
    const lo = !minPrice || p.price >= Number(minPrice);
    const hi = !maxPrice || p.price <= Number(maxPrice);
    return s && t && lo && hi;
  });

  const TABS = {
    admin: [{ id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'users', label: 'Users', icon: '👥' }, { id: 'properties', label: 'Properties', icon: '🏠' }, { id: 'bookings', label: 'Bookings', icon: '📋' }],
    host:  [{ id: 'browse', label: 'Discover', icon: '🔍' }, { id: 'listings', label: 'My Listings', icon: '🏠' }, { id: 'bookings', label: 'Bookings', icon: '📋' }],
    guest: [{ id: 'browse', label: 'Discover', icon: '🔍' }, { id: 'trips', label: 'My Trips', icon: '✈️' }],
  };
  const tabList = TABS[role] || TABS.guest;

  const fieldVal = (key) => editingProperty ? (editingProperty[key] ?? '') : (newProp[key] ?? '');
  const setField = (key) => (e) => {
    const v = e.target.value;
    editingProperty ? setEditingProperty({ ...editingProperty, [key]: v }) : setNewProp({ ...newProp, [key]: v });
  };

  return (
    <div className="min-h-screen" style={{ background: '#F7F7F7', fontFamily: 'Inter, sans-serif' }}>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 30 32" className="w-8 h-8" style={{ fill: '#FF385C' }}>
              <path d="M15 1C8 10 3 15.5 3 20.5a12 12 0 0024 0C27 15.5 22 10 15 1z" />
            </svg>
            <span className="text-xl font-bold tracking-tight" style={{ color: '#FF385C' }}>StayKenya</span>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 cursor-pointer hover:shadow-md transition-shadow">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: '#FF385C' }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name?.split(' ')[0]}</span>
              <Badge label={role} color={ROLE_BADGE[role]} />
            </div>
            <button onClick={handleDeleteAccount}
              className="text-sm font-medium px-3 py-2 rounded-full text-red-400 hover:bg-red-50 hover:text-red-500 transition">
              Delete Account
            </button>
            <button onClick={onLogout}
              className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition text-gray-700">
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── TABS ── */}
        <div className="flex items-center gap-2 mb-8 bg-white rounded-2xl p-1.5 border border-gray-200 w-fit shadow-sm">
          {tabList.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={activeTab === t.id
                ? { background: '#FF385C', color: 'white', boxShadow: '0 2px 8px rgba(255,56,92,0.35)' }
                : { color: '#717171', background: 'transparent' }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ════ BROWSE ════════════════════════════════════════════════════ */}
        {activeTab === 'browse' && (
          <div>
            {/* Hero */}
            <div className="rounded-3xl p-8 mb-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #FF385C 0%, #BD1E59 50%, #6B21A8 100%)' }}>
              <div className="relative z-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight">Find your perfect stay</h1>
                <p className="text-white/80 text-lg font-light">Thousands of unique homes across Kenya</p>
              </div>
              <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full opacity-10 bg-white" />
              <div className="absolute right-24 -top-4 w-24 h-24 rounded-full opacity-10 bg-white" />
            </div>

            {/* Filters card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-1 relative">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Where to?</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                    <input type="text" placeholder="Nairobi, Mombasa, Kisumu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                      style={{ '--tw-ring-color': '#FF385C' }}
                      onFocus={e => e.target.style.borderColor = '#FF385C'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Min Price (KSh)</label>
                  <input type="number" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                    onFocus={e => e.target.style.borderColor = '#FF385C'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Max Price (KSh)</label>
                  <input type="number" placeholder="No limit" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                    onFocus={e => e.target.style.borderColor = '#FF385C'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                </div>
              </div>
              {/* Category pills */}
              <div className="flex gap-2 flex-wrap">
                {['All', ...UNIT_TYPES].map(type => (
                  <button key={type} onClick={() => setUnitFilter(type)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all border"
                    style={unitFilter === type
                      ? { background: '#222', color: 'white', borderColor: '#222' }
                      : { background: 'white', color: '#555', borderColor: '#DDDDDD' }}>
                    {CAT_ICONS[type]} {type}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-gray-400 font-medium mb-5">{filtered.length} {filtered.length === 1 ? 'place' : 'places'} available</p>

            {filtered.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
                <div className="text-6xl mb-4">🏠</div>
                <h3 className="text-xl font-bold text-gray-700">No properties found</h3>
                <p className="text-gray-400 mt-2 text-sm">Try changing your search or filters</p>
                <button onClick={() => { setSearchTerm(''); setUnitFilter('All'); setMinPrice(''); setMaxPrice(''); }}
                  className="mt-4 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition" style={{ background: '#FF385C' }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filtered.map(p => <PropertyCard key={p._id} property={p} onClick={openPanel} />)}
              </div>
            )}
          </div>
        )}

        {/* ════ MY TRIPS ══════════════════════════════════════════════════ */}
        {activeTab === 'trips' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900">My Trips</h2>
              <p className="text-gray-400 text-sm mt-1">Your upcoming and past stays</p>
            </div>
            {myBookings.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
                <div className="text-6xl mb-4">✈️</div>
                <h3 className="text-xl font-bold text-gray-700">No trips yet</h3>
                <p className="text-gray-400 mt-2 text-sm">Browse properties and book your first stay</p>
                <button onClick={() => setActiveTab('browse')}
                  className="mt-5 px-7 py-3 rounded-full text-sm font-bold text-white transition" style={{ background: '#FF385C' }}>
                  Explore Stays
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map(b => (
                  <div key={b._id} className={`bg-white rounded-2xl overflow-hidden border flex flex-col sm:flex-row ${isExpired(b.checkOut) ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}
                    style={{ boxShadow: isExpired(b.checkOut) ? 'none' : '0 2px 16px rgba(0,0,0,0.06)' }}>
                    <div className="sm:w-44 h-36 sm:h-auto flex-shrink-0 bg-gray-100">
                      <img src={b.property?.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&q=70'} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-5 flex-1 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{b.property?.title || 'Property'}</h3>
                        <p className="text-gray-500 text-sm mt-0.5">📍 {b.property?.location}</p>
                        {b.checkIn && b.checkOut && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <span className="bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-medium">{fmtDate(b.checkIn)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-medium">{fmtDate(b.checkOut)}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{b.guests || 1} guest{(b.guests || 1) > 1 ? 's' : ''} · {b.paymentMethod || 'mpesa'}</p>
                        {isExpired(b.checkOut) && <p className="text-xs text-gray-400 italic mt-1">Property access has ended</p>}
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:min-w-[120px]">
                        <StatusBadge status={b.status} checkOut={b.checkOut} />
                        <p className="font-extrabold text-gray-900">KSh {fmt(b.totalPrice)}</p>
                        {!isExpired(b.checkOut) && b.status !== 'cancelled' && (
                          <button onClick={() => handleCancelBooking(b._id)} className="text-xs font-semibold text-red-400 hover:text-red-600 transition">Cancel</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ MY LISTINGS (host) ════════════════════════════════════════ */}
        {activeTab === 'listings' && (
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">My Listings</h2>
                <p className="text-gray-400 text-sm mt-1">{myProperties.length} {myProperties.length === 1 ? 'property' : 'properties'} listed</p>
              </div>
              <button onClick={() => { setEditingProperty(null); setNewProp(blank); setShowAddModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition"
                style={{ background: '#FF385C', boxShadow: '0 2px 8px rgba(255,56,92,0.35)' }}>
                <span className="text-lg leading-none">+</span> Add Property
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Listings',       value: myProperties.length,                                                              icon: '🏠', color: '#222' },
                { label: 'Total Bookings', value: myBookings.length,                                                                icon: '📋', color: '#3B82F6' },
                { label: 'Active',         value: myBookings.filter(b => !isExpired(b.checkOut) && b.status !== 'cancelled').length, icon: '✅', color: '#10B981' },
                { label: 'Est. Revenue',   value: `KSh ${fmt(myProperties.reduce((s, p) => s + (p.price || 0), 0) * 10)}`,         icon: '💰', color: '#FF385C' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-extrabold mt-0.5" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {myProperties.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                <div className="text-5xl mb-3">🏠</div>
                <h3 className="font-bold text-gray-700 text-lg">No listings yet</h3>
                <p className="text-gray-400 text-sm mt-1">Add your first property to start hosting</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {myProperties.map(p => (
                  <div key={p._id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-200 transition" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                    <div className="relative h-44">
                      <img src={p.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=70'} alt={p.title} className="w-full h-full object-cover" />
                      <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">{p.unitType}</span>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-gray-900">{p.title}</h4>
                      <p className="text-gray-400 text-sm mt-0.5">📍 {p.location}</p>
                      <div className="flex justify-between items-center mt-3">
                        <p className="font-extrabold text-gray-900">KSh {fmt(p.price)}<span className="text-gray-400 font-normal text-xs"> /night</span></p>
                        <p className="text-xs text-gray-400">{p.guests || 10} guests max</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => { setEditingProperty(p); setShowAddModal(true); }}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition"
                          style={{ background: '#222' }}>Edit</button>
                        <button onClick={() => handleDeleteProperty(p._id)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ HOST BOOKINGS ══════════════════════════════════════════════ */}
        {activeTab === 'bookings' && role === 'host' && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Bookings</h2>
            {myBookings.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-bold text-gray-700">No bookings yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100" style={{ background: '#FAFAFA' }}>
                        {['Property', 'Guest', 'Check-in', 'Check-out', 'Guests', 'Payment', 'Total', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {myBookings.map(b => (
                        <tr key={b._id} className={`hover:bg-gray-50 transition ${isExpired(b.checkOut) ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3.5 font-semibold text-gray-900">{b.property?.title}</td>
                          <td className="px-4 py-3.5 text-gray-500">{b.guest?.name || 'Guest'}</td>
                          <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{b.checkOut ? new Date(b.checkOut).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3.5 text-center text-gray-500">{b.guests || '—'}</td>
                          <td className="px-4 py-3.5 capitalize text-gray-400">{b.paymentMethod || '—'}</td>
                          <td className="px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">KSh {fmt(b.totalPrice)}</td>
                          <td className="px-4 py-3.5"><StatusBadge status={b.status} checkOut={b.checkOut} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ ADMIN DASHBOARD ══════════════════════════════════════════ */}
        {activeTab === 'dashboard' && role === 'admin' && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Dashboard</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Users',     value: allUsers.length,                                                              icon: '👥', bg: '#F3E8FF', color: '#7E22CE' },
                { label: 'Properties',      value: properties.length,                                                            icon: '🏠', bg: '#EFF6FF', color: '#1D4ED8' },
                { label: 'Total Bookings',  value: allBookings.length,                                                           icon: '📋', bg: '#FFFBEB', color: '#B45309' },
                { label: 'Active Bookings', value: allBookings.filter(b => !isExpired(b.checkOut) && b.status !== 'cancelled').length, icon: '✅', bg: '#ECFDF5', color: '#065F46' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-5 border" style={{ background: s.bg, borderColor: s.bg, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                  <p className="text-3xl font-extrabold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 className="font-bold text-gray-900 mb-4 text-base">Recent Bookings</h3>
              <div className="space-y-3">
                {allBookings.slice(0, 6).map(b => (
                  <div key={b._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="font-semibold text-gray-900 text-sm">{b.property?.title || 'Property'}</span>
                      <span className="text-gray-400 text-sm ml-2">by {b.guest?.name || 'Guest'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">KSh {fmt(b.totalPrice)}</span>
                      <StatusBadge status={b.status} checkOut={b.checkOut} />
                    </div>
                  </div>
                ))}
                {allBookings.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No bookings yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ════ ADMIN USERS ══════════════════════════════════════════════ */}
        {activeTab === 'users' && role === 'admin' && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Users</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100" style={{ background: '#FAFAFA' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {allUsers.map(u => (
                      <tr key={u._id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#FF385C' }}>{u.name?.[0]?.toUpperCase()}</div>
                            <span className="font-semibold text-gray-900">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-400">{u.email}</td>
                        <td className="px-5 py-3.5"><Badge label={u.role || 'guest'} color={ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-500'} /></td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">{u._id !== uid(user) && <button onClick={() => handleDeleteUser(u._id)} className="text-xs font-semibold text-red-400 hover:text-red-600 transition">Remove</button>}</td>
                      </tr>
                    ))}
                    {allUsers.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-gray-400">No users found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ ADMIN PROPERTIES ════════════════════════════════════════ */}
        {activeTab === 'properties' && role === 'admin' && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">All Properties</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100" style={{ background: '#FAFAFA' }}>
                    {['Property', 'Host', 'Location', 'Type', 'Price/Night', 'Actions'].map(h => <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {properties.map(p => (
                      <tr key={p._id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{p.title}</td>
                        <td className="px-5 py-3.5 text-gray-400">{p.host?.name || 'Host'}</td>
                        <td className="px-5 py-3.5 text-gray-400">📍 {p.location}</td>
                        <td className="px-5 py-3.5 text-gray-400">{p.unitType}</td>
                        <td className="px-5 py-3.5 font-bold">KSh {fmt(p.price)}</td>
                        <td className="px-5 py-3.5"><button onClick={() => handleDeleteProperty(p._id)} className="text-xs font-semibold text-red-400 hover:text-red-600 transition">Delete</button></td>
                      </tr>
                    ))}
                    {properties.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-gray-400">No properties</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ ADMIN ALL BOOKINGS ══════════════════════════════════════ */}
        {activeTab === 'bookings' && role === 'admin' && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">All Bookings</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100" style={{ background: '#FAFAFA' }}>
                    {['Property', 'Guest', 'Check-in', 'Check-out', 'Guests', 'Payment', 'Total', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {allBookings.map(b => (
                      <tr key={b._id} className={`hover:bg-gray-50 transition ${isExpired(b.checkOut) ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3.5 font-semibold text-gray-900">{b.property?.title || '—'}</td>
                        <td className="px-4 py-3.5 text-gray-500">{b.guest?.name || '—'}</td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{b.checkIn ? new Date(b.checkIn).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{b.checkOut ? new Date(b.checkOut).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3.5 text-center text-gray-400">{b.guests || '—'}</td>
                        <td className="px-4 py-3.5 capitalize text-gray-400">{b.paymentMethod || '—'}</td>
                        <td className="px-4 py-3.5 font-bold whitespace-nowrap">KSh {fmt(b.totalPrice)}</td>
                        <td className="px-4 py-3.5"><StatusBadge status={b.status} checkOut={b.checkOut} /></td>
                        <td className="px-4 py-3.5">{!isExpired(b.checkOut) && b.status !== 'cancelled' && <button onClick={() => handleCancelBooking(b._id)} className="text-xs font-semibold text-red-400 hover:text-red-600">Cancel</button>}</td>
                      </tr>
                    ))}
                    {allBookings.length === 0 && <tr><td colSpan="9" className="text-center py-10 text-gray-400">No bookings found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>{/* /max-w-6xl */}

      {/* ════ BOOKING SLIDE-IN PANEL ════════════════════════════════════ */}
      {/* Overlay */}
      {selectedProperty && (
        <div
          className="fade-overlay fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', opacity: panelOpen ? 1 : 0 }}
          onClick={closePanel}
        />
      )}

      {/* Slide panel */}
      <div
        className="slide-panel fixed top-0 right-0 h-full z-50 bg-white overflow-y-auto"
        style={{
          width: '100%',
          maxWidth: '480px',
          transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-4px 0 40px rgba(0,0,0,0.15)',
        }}
      >
        {selectedProperty && (
          <>
            {/* Property image header */}
            <div className="relative h-64 bg-gray-100 flex-shrink-0">
              <img
                src={selectedProperty.image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80'}
                alt={selectedProperty.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <button onClick={closePanel}
                className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-md hover:scale-105 transition font-bold text-gray-600">
                ✕
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="text-xl font-extrabold text-white">{selectedProperty.title}</h2>
                <p className="text-white/80 text-sm mt-0.5">📍 {selectedProperty.location} · {selectedProperty.unitType}</p>
              </div>
            </div>

            <div className="p-6">
              {/* Description */}
              {selectedProperty.description && (
                <p className="text-gray-600 text-sm leading-relaxed mb-6 pb-6 border-b border-gray-100">
                  {selectedProperty.description}
                </p>
              )}

              {/* Step indicators */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[['details', '1', 'Dates & Guests'], ['payment', '2', 'Payment'], ['confirm', '3', 'Confirm']].map(([id, num, label], i) => {
                  const steps = ['details', 'payment', 'confirm'];
                  const done  = steps.indexOf(bookingStep) > i;
                  const active = bookingStep === id;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all"
                          style={{ background: active ? '#FF385C' : done ? '#10B981' : '#F3F4F6', color: (active || done) ? 'white' : '#9CA3AF' }}>
                          {done ? '✓' : num}
                        </div>
                        <span className="text-xs font-semibold hidden sm:block" style={{ color: active ? '#FF385C' : '#9CA3AF' }}>{label}</span>
                      </div>
                      {i < 2 && <div className="w-6 h-px bg-gray-200 mx-1" />}
                    </div>
                  );
                })}
              </div>

              {/* ── Step 1: Dates & Guests ── */}
              {bookingStep === 'details' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Check-in</label>
                      <input type="date" min={today} value={checkInDate}
                        onChange={e => { setCheckInDate(e.target.value); if (checkOutDate && e.target.value >= checkOutDate) setCheckOutDate(''); }}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none"
                        onFocus={e => e.target.style.borderColor = '#FF385C'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Check-out</label>
                      <input type="date" min={checkInDate || today} value={checkOutDate}
                        onChange={e => setCheckOutDate(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none"
                        onFocus={e => e.target.style.borderColor = '#FF385C'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                    </div>
                  </div>

                  {nights > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#FFF0F3', color: '#FF385C' }}>
                      📅 {nights} night{nights > 1 ? 's' : ''} selected
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Guests <span className="text-gray-300 font-normal normal-case">(max {selectedProperty.guests || 10})</span>
                    </label>
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl w-fit border border-gray-200">
                      <button onClick={() => setBookingGuests(g => Math.max(1, g - 1))}
                        className="w-9 h-9 rounded-full border-2 border-gray-300 font-bold text-gray-500 hover:border-gray-500 transition flex items-center justify-center text-lg">
                        −
                      </button>
                      <span className="text-xl font-extrabold text-gray-900 w-7 text-center">{bookingGuests}</span>
                      <button onClick={() => setBookingGuests(g => Math.min(selectedProperty.guests || 10, g + 1))}
                        className="w-9 h-9 rounded-full border-2 border-gray-300 font-bold text-gray-500 hover:border-gray-500 transition flex items-center justify-center text-lg">
                        +
                      </button>
                      <span className="text-gray-400 text-sm">guest{bookingGuests > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {nights > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>KSh {fmt(selectedProperty.price)} × {nights} night{nights > 1 ? 's' : ''}</span>
                        <span className="font-semibold">KSh {fmt(totalPrice)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 flex justify-between font-extrabold text-base">
                        <span>Total</span>
                        <span style={{ color: '#FF385C' }}>KSh {fmt(totalPrice)}</span>
                      </div>
                    </div>
                  )}

                  <button onClick={goToPayment}
                    className="w-full py-4 rounded-2xl font-extrabold text-white text-base transition"
                    style={{ background: 'linear-gradient(135deg, #FF385C, #E31C5F)', boxShadow: '0 4px 14px rgba(255,56,92,0.4)' }}>
                    Continue to Payment →
                  </button>
                </div>
              )}

              {/* ── Step 2: Payment ── */}
              {bookingStep === 'payment' && (
                <div className="space-y-4">
                  <h3 className="font-extrabold text-gray-900 text-base mb-1">How would you like to pay?</h3>
                  {PAYMENT_OPS.map(opt => (
                    <button key={opt.id} onClick={() => setPaymentMethod(opt.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition"
                      style={{
                        borderColor: paymentMethod === opt.id ? '#FF385C' : '#E5E7EB',
                        background: paymentMethod === opt.id ? '#FFF0F3' : '#FAFAFA',
                      }}>
                      <span className="text-3xl w-9 text-center">{opt.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{opt.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition"
                        style={{ borderColor: paymentMethod === opt.id ? '#FF385C' : '#D1D5DB', background: paymentMethod === opt.id ? '#FF385C' : 'white' }}>
                        {paymentMethod === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setBookingStep('details')}
                      className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition">← Back</button>
                    <button onClick={goToConfirm}
                      className="flex-1 py-3.5 rounded-2xl text-sm font-extrabold text-white transition"
                      style={{ background: '#FF385C' }}>Review Booking →</button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm ── */}
              {bookingStep === 'confirm' && (
                <div className="space-y-4">
                  <h3 className="font-extrabold text-gray-900 text-base">Booking Summary</h3>
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-200 text-sm">
                    {[
                      ['Property',  selectedProperty.title],
                      ['Location',  selectedProperty.location],
                      ['Check-in',  fmtDate(checkInDate)],
                      ['Check-out', fmtDate(checkOutDate)],
                      ['Nights',    `${nights} night${nights > 1 ? 's' : ''}`],
                      ['Guests',    `${bookingGuests} guest${bookingGuests > 1 ? 's' : ''}`],
                      ['Payment',   PAYMENT_OPS.find(p => p.id === paymentMethod)?.label],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-400 font-medium">{k}</span>
                        <span className="font-semibold text-gray-900 text-right">{v}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-3 mt-2 flex justify-between items-center">
                      <span className="font-extrabold text-gray-900 text-base">Total</span>
                      <span className="font-extrabold text-xl" style={{ color: '#FF385C' }}>KSh {fmt(totalPrice)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBookingStep('payment')}
                      className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition">← Back</button>
                    <button onClick={handleBook}
                      className="flex-1 py-3.5 rounded-2xl font-extrabold text-sm text-white transition"
                      style={{ background: 'linear-gradient(135deg, #FF385C, #E31C5F)', boxShadow: '0 4px 14px rgba(255,56,92,0.4)' }}>
                      ✓ Confirm & Pay
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════ ADD / EDIT PROPERTY MODAL ════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-extrabold text-gray-900">{editingProperty ? 'Edit Property' : 'Add New Property'}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingProperty(null); }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold hover:bg-gray-200 transition">✕</button>
              </div>

              <form onSubmit={handleSaveProperty} className="space-y-4">
                {[
                  { label: 'Property Title *', key: 'title',    type: 'text',   placeholder: 'e.g. Cosy Studio in Westlands' },
                  { label: 'Location *',       key: 'location', type: 'text',   placeholder: 'e.g. Nairobi, Westlands'       },
                  { label: 'Price per Night (KSh) *', key: 'price', type: 'number', placeholder: '5000'                      },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} required value={fieldVal(f.key)} onChange={setField(f.key)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                      onFocus={e => e.target.style.borderColor = '#FF385C'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea placeholder="Describe your property…" rows={3} value={fieldVal('description')} onChange={setField('description')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition resize-none"
                    onFocus={e => e.target.style.borderColor = '#FF385C'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Max Guests</label>
                    <input type="number" min="1" max="10" value={fieldVal('guests')} onChange={setField('guests')}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                      onFocus={e => e.target.style.borderColor = '#FF385C'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Property Type</label>
                    <select value={fieldVal('unitType')} onChange={setField('unitType')}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition bg-white"
                      onFocus={e => e.target.style.borderColor = '#FF385C'}
                      onBlur={e => e.target.style.borderColor = '#E5E7EB'}>
                      {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Image URL</label>
                  <input type="text" placeholder="https://images.unsplash.com/..." value={fieldVal('image')} onChange={setField('image')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none transition"
                    onFocus={e => e.target.style.borderColor = '#FF385C'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
                  <p className="text-xs text-gray-400 mt-1">💡 Tip: Paste any image URL from Unsplash, Pexels etc.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit"
                    className="flex-1 py-3.5 rounded-2xl font-extrabold text-white text-sm transition"
                    style={{ background: 'linear-gradient(135deg, #FF385C, #E31C5F)', boxShadow: '0 4px 14px rgba(255,56,92,0.35)' }}>
                    {editingProperty ? 'Save Changes' : 'Add Property'}
                  </button>
                  <button type="button" onClick={() => { setShowAddModal(false); setEditingProperty(null); }}
                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════ FOOTER ════════════════════════════════════════════════════ */}
      <footer className="mt-16 text-white" style={{ background: '#222222' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg viewBox="0 0 30 32" className="w-6 h-6" style={{ fill: '#FF385C' }}>
                  <path d="M15 1C8 10 3 15.5 3 20.5a12 12 0 0024 0C27 15.5 22 10 15 1z" />
                </svg>
                <span className="font-bold text-lg">StayKenya</span>
              </div>
              <p style={{ color: '#717171' }} className="text-sm">Your trusted platform for short-term stays in Kenya</p>
            </div>
            <div className="text-right" style={{ color: '#717171' }}>
              <p className="text-sm">Developed by <span className="text-white font-semibold">_.nyaga._</span></p>
              <p className="text-sm mt-0.5">© 2026 StayKenya · Final Year Project</p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}