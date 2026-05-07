const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {

  const {
    gender,
    ageFrom,
    ageTo,
    city
  } = req.query;

  let sql = 'SELECT * FROM users WHERE 1=1';

  if (gender) {
    sql += ` AND gender='${gender}'`;
  }

  if (city) {
    sql += ` AND city='${city}'`;
  }

  if (ageFrom && ageTo) {
    sql += ` AND age BETWEEN ${ageFrom} AND ${ageTo}`;
  }

  db.query(sql, (err, results) => {

    if (err) {
      return res.status(500).json(err);
    }

    res.json(results);
  });
});

module.exports = router;