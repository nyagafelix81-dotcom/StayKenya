import express from 'express';
import {
  createBooking,
  getMyBookings,
  getHostBookings,
  getAllBookings,
  cancelBooking,
} from '../controllers/booking.controller.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const router = express.Router();

// All booking routes require login
router.use(protect);

router.post('/',          restrictTo('guest'),         createBooking);
router.get('/my',         restrictTo('guest'),         getMyBookings);
router.get('/host',       restrictTo('host'),          getHostBookings);
router.get('/',           restrictTo('admin'),         getAllBookings);
router.delete('/:id',                                  cancelBooking);   // guest, host, or admin

export default router;
