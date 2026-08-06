import express  from 'express';
import Booking  from '../models/Booking.js';
import Property from '../models/Property.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const router = express.Router();

// All booking routes require login
router.use(protect);

// POST create booking (guest)
router.post('/', async (req, res) => {
  try {
    const { property, checkIn, checkOut, guests, paymentMethod, totalPrice } = req.body;
    if (!property || !checkIn || !checkOut)
      return res.status(400).json({ message: 'Please provide property, check-in and check-out dates' });

    const propertyData = await Property.findById(property);
    if (!propertyData) return res.status(404).json({ message: 'Property not found' });

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (checkOutDate <= checkInDate)
      return res.status(400).json({ message: 'Check-out must be after check-in' });

    const nights        = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const computedTotal = totalPrice || nights * propertyData.price;

    const booking = await Booking.create({
      property,
      guest:         req.user._id,
      checkIn:       checkInDate,
      checkOut:      checkOutDate,
      guests:        guests || 1,
      paymentMethod: paymentMethod || 'mpesa',
      totalPrice:    computedTotal,
      status:        'confirmed',
    });

    await booking.populate('property', 'title location price image');
    res.status(201).json({ message: 'Booking confirmed!', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET my bookings (guest)
router.get('/my', async (req, res) => {
  try {
    const bookings = await Booking.find({ guest: req.user._id })
      .populate('property', 'title location price image')
      .populate('guest', 'name email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET host's bookings (host)
router.get('/host', async (req, res) => {
  try {
    const properties  = await Property.find({ host: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    const bookings = await Booking.find({ property: { $in: propertyIds } })
      .populate('property', 'title location price')
      .populate('guest', 'name email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all bookings (admin)
router.get('/', restrictTo('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('property', 'title location')
      .populate('guest', 'name email')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE / cancel booking (guest, host, or admin)
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const isGuest = booking.guest.toString()              === req.user._id.toString();
    const isHost  = booking.property?.host?.toString()    === req.user._id.toString();
    const isAdmin = req.user.role                         === 'admin';

    if (!isGuest && !isHost && !isAdmin)
      return res.status(403).json({ message: 'Not authorized' });

    booking.status = 'cancelled';
    await booking.save();
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;