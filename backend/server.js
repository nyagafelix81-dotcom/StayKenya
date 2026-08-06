import express   from 'express';
import mongoose  from 'mongoose';
import cors      from 'cors';
import dotenv    from 'dotenv';
import bcrypt    from 'bcryptjs';
import jwt       from 'jsonwebtoken';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5001;
const JWT  = process.env.JWT_SECRET || 'staykenya_secret_2026';

app.use(cors({ origin: ['http://localhost:5173','http://127.0.0.1:5173'], credentials: true }));
app.use(express.json());

// ── Models ────────────────────────────────────────────────────────────────────
import mongoose_pkg from 'mongoose';
const { Schema, model } = mongoose_pkg;

const UserSchema = new Schema({
  name:     { type:String, required:true, trim:true },
  email:    { type:String, required:true, unique:true, lowercase:true },
  password: { type:String, required:true, minlength:6 },
  role:     { type:String, enum:['guest','host','admin'], default:'guest' },
}, { timestamps:true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
UserSchema.methods.matchPassword = function(pwd) { return bcrypt.compare(pwd, this.password); };

const PropertySchema = new Schema({
  title:       { type:String, required:true },
  description: { type:String, default:'' },
  price:       { type:Number, required:true },
  location:    { type:String, required:true },
  unitType:    { type:String, enum:['Entire home','Private room','Shared room','Guest house','Hotel'], default:'Entire home' },
  image:       { type:String, default:'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80' },
  host:        { type:Schema.Types.ObjectId, ref:'User', required:true },
  bedrooms:    { type:Number, default:1 },
  bathrooms:   { type:Number, default:1 },
  guests:      { type:Number, default:10 },
  status:      { type:String, enum:['available','booked'], default:'available' },
}, { timestamps:true });

const BookingSchema = new Schema({
  property:      { type:Schema.Types.ObjectId, ref:'Property', required:true },
  guest:         { type:Schema.Types.ObjectId, ref:'User', required:true },
  checkIn:       { type:Date, required:true },
  checkOut:      { type:Date, required:true },
  guests:        { type:Number, default:1 },
  paymentMethod: { type:String, enum:['mpesa','card','cash'], default:'mpesa' },
  totalPrice:    { type:Number, required:true },
  status:        { type:String, enum:['pending','confirmed','cancelled'], default:'confirmed' },
}, { timestamps:true });

const User     = model('User',     UserSchema);
const Property = model('Property', PropertySchema);
const Booking  = model('Booking',  BookingSchema);

// ── Auth helper ───────────────────────────────────────────────────────────────
const genToken = (id) => jwt.sign({ userId: id }, JWT, { expiresIn: '7d' });

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: 'Not authorized' });
    const decoded = jwt.verify(auth.split(' ')[1], JWT);
    req.user = await User.findById(decoded.userId).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch { return res.status(401).json({ message: 'Token invalid or expired' }); }
};

const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Permission denied' });

// ── AUTH routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role: r } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password, role: r === 'host' ? 'host' : 'guest' });
    res.status(201).json({ message: 'Account created', token: genToken(user._id), user: { id:user._id, name:user.name, email:user.email, role:user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.matchPassword(password))) return res.status(400).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', token: genToken(user._id), user: { id:user._id, name:user.name, email:user.email, role:user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/auth/me', protect, (req, res) => {
  res.json({ id:req.user._id, name:req.user.name, email:req.user.email, role:req.user.role });
});

// DELETE own account
app.delete('/api/auth/me', protect, async (req, res) => {
  try {
    // Cancel all their bookings and delete associated data
    await Booking.deleteMany({ guest: req.user._id });
    // If host, remove their properties and related bookings
    if (req.user.role === 'host') {
      const props = await Property.find({ host: req.user._id }).select('_id');
      const ids   = props.map(p => p._id);
      await Booking.deleteMany({ property: { $in: ids } });
      await Property.deleteMany({ host: req.user._id });
    }
    await User.findByIdAndDelete(req.user._id);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PROPERTY routes ───────────────────────────────────────────────────────────
app.get('/api/properties', async (req, res) => {
  try {
    const { location, minPrice, maxPrice, unitType } = req.query;
    const filter = {};
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (unitType && unitType !== 'All') filter.unitType = unitType;
    if (minPrice || maxPrice) { filter.price = {}; if (minPrice) filter.price.$gte = Number(minPrice); if (maxPrice) filter.price.$lte = Number(maxPrice); }
    const props = await Property.find(filter).populate('host', 'name email');
    res.json(props);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const p = await Property.findById(req.params.id).populate('host', 'name email');
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/properties', protect, role('host','admin'), async (req, res) => {
  try {
    const p = new Property({ ...req.body, host: req.user._id });
    await p.save();
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/properties/:id', protect, role('host','admin'), async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    if (p.host.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });
    const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/properties/:id', protect, role('host','admin'), async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    if (p.host.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── BOOKING routes ────────────────────────────────────────────────────────────
app.post('/api/bookings', protect, async (req, res) => {
  try {
    const { property, checkIn, checkOut, guests, paymentMethod, totalPrice } = req.body;
    if (!property || !checkIn || !checkOut) return res.status(400).json({ message: 'Property and dates required' });
    const prop = await Property.findById(property);
    if (!prop) return res.status(404).json({ message: 'Property not found' });
    const inDate  = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (outDate <= inDate) return res.status(400).json({ message: 'Check-out must be after check-in' });
    const nights = Math.ceil((outDate - inDate) / 86400000);
    const booking = await Booking.create({
      property, guest: req.user._id, checkIn: inDate, checkOut: outDate,
      guests: guests || 1, paymentMethod: paymentMethod || 'mpesa',
      totalPrice: totalPrice || nights * prop.price, status: 'confirmed',
    });
    await booking.populate('property', 'title location price image');
    res.status(201).json({ message: 'Booking confirmed!', booking });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/bookings/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ guest: req.user._id })
      .populate('property', 'title location price image')
      .populate('guest', 'name email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/bookings/host', protect, role('host'), async (req, res) => {
  try {
    const props = await Property.find({ host: req.user._id }).select('_id');
    const bookings = await Booking.find({ property: { $in: props.map(p=>p._id) } })
      .populate('property','title location price').populate('guest','name email').sort({ createdAt:-1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/bookings', protect, role('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('property','title location').populate('guest','name email').sort({ createdAt:-1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/bookings/:id', protect, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id).populate('property');
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    const isGuest = b.guest.toString() === req.user._id.toString();
    const isHost  = b.property?.host?.toString() === req.user._id.toString();
    if (!isGuest && !isHost && req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
    b.status = 'cancelled';
    await b.save();
    res.json({ message: 'Cancelled' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ADMIN routes ──────────────────────────────────────────────────────────────
app.get('/api/admin/users', protect, role('admin'), async (req, res) => {
  try { res.json(await User.find().select('-password').sort({ createdAt:-1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/admin/users/:id', protect, role('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'Cannot delete yourself' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/stats', protect, role('admin'), async (req, res) => {
  try {
    const [totalUsers, totalProperties, totalBookings, confirmed] = await Promise.all([
      User.countDocuments(), Property.countDocuments(), Booking.countDocuments(), Booking.countDocuments({ status:'confirmed' })
    ]);
    res.json({ totalUsers, totalProperties, totalBookings, confirmedBookings: confirmed });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB Error:', err.message); process.exit(1); });