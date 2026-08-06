import express  from 'express';
import Property from '../models/Property.js';
import { protect, restrictTo } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET all (public) with optional filters
router.get('/', async (req, res) => {
  try {
    const { location, minPrice, maxPrice, unitType } = req.query;
    const filter = {};
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (unitType && unitType !== 'All') filter.unitType = unitType;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const properties = await Property.find(filter).populate('host', 'name email');
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single (public)
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('host', 'name email');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    res.json(property);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create (host/admin)
router.post('/', protect, restrictTo('host', 'admin'), async (req, res) => {
  try {
    const property = new Property({ ...req.body, host: req.user._id });
    await property.save();
    res.status(201).json(property);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update (host must own it, or admin)
router.put('/:id', protect, restrictTo('host', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    const isOwner = property.host.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });
    const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE (host must own it, or admin)
router.delete('/:id', protect, restrictTo('host', 'admin'), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    const isOwner = property.host.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });
    await property.deleteOne();
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;