const express = require('express');
  const {
    name,
    email,
    password,
    age,
    gender
  } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.query(
    'INSERT INTO users(name,email,password,age,gender) VALUES(?,?,?,?,?)',
    [name, email, hash, age, gender],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: 'User registered'
      });
    }
  );


router.post('/login', (req, res) => {

  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email=?',
    [email],
    async (err, results) => {

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];

      const compare = await bcrypt.compare(password, user.password);

      if (!compare) {
        return res.status(400).json({ message: 'Wrong password' });
      }

      const token = jwt.sign({
        id: user.id
      }, 'jwt_secret');

      res.json({
        token,
        user
      });
    }
  );
});

router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login.html'
  }),
  (req, res) => {
    res.redirect('/profile.html');
  }
);

router.get('/vk', passport.authenticate('vkontakte'));

router.get('/vk/callback',
  passport.authenticate('vkontakte', {
    failureRedirect: '/login.html'
  }),
  (req, res) => {
    res.redirect('/profile.html');
  }
);

module.exports = router;