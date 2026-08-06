import User     from '../models/User.js';
import Property from '../models/Property.js';
import Booking  from '../models/Booking.js';

// ── GET all users ─────────────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE user ───────────────────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET platform stats ────────────────────────────────────────────────────────
export const getStats = async (req, res) => {
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
};
