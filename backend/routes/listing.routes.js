import express from "express";
import {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getMyListings,
} from "../controllers/listing.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", getAllListings);                          // Public - search listings
router.get("/my", protect, restrictTo("host"), getMyListings); // Host's own listings
router.get("/:id", getListingById);                       // Public - single listing

router.post("/", protect, restrictTo("host", "admin"), createListing);
router.put("/:id", protect, restrictTo("host", "admin"), updateListing);
router.delete("/:id", protect, restrictTo("host", "admin"), deleteListing);

export default router;
