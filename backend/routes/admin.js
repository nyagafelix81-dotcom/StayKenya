import express  from 'express';
import User     from '../models/User.js';
import Property from '../models/Property.js';
import Booking  from '../models/Booking.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require login + admin role
router.use(protect, restrictTo('admin'));

// GET all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE user
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: 'You cannot delete your own account' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalProperties, totalBookings, confirmedBookings] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'confirmed' }),
    ]);
    res.json({ totalUsers, totalProperties, totalBookings, confirmedBookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;