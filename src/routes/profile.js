const express = require('express');
const db = require('../config/db');
const multer = require('multer');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/update/:id', upload.single('avatar'), (req, res) => {

  const id = req.params.id;

  const {
    name,
    age,
    gender,
    city,
    bio,
    preferences,
    height,
    weight
  } = req.body;

  const avatar = req.file ? req.file.filename : null;

  db.query(
    `UPDATE users SET
    name=?,
    age=?,
    gender=?,
    city=?,
    bio=?,
    preferences=?,
    height=?,
    weight=?,
    avatar=?
    WHERE id=?`,
    [
      name,
      age,
      gender,
      city,
      bio,
      preferences,
      height,
      weight,
      avatar,
      id
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: 'Profile updated'
      });
    }
  );
});

module.exports = router;