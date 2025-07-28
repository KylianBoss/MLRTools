import e, { Router } from "express";
import { db } from "../database.js";

const router = Router();

router.post("/upload", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image data is required" });
    }

    // Create a new image record in the database
    const imageRecord = await db.models.Images.create({
      data: image,
      name: `image-${Date.now()}.jpg`, // Generate a unique filename
    });
    res.json({ id: imageRecord.id });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const image = await db.models.Images.findByPk(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.send(image.data);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
