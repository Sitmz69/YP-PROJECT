const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

require('./src/config/passport');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'linkyou_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/profile', require('./src/routes/profile'));
app.use('/api/search', require('./src/routes/search'));

app.listen(5000, () => {
  console.log('Server started on port 5000');
});