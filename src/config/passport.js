const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const VKontakteStrategy = require('passport-vkontakte').Strategy;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
  clientID: 'GOOGLE_CLIENT_ID',
  clientSecret: 'GOOGLE_CLIENT_SECRET',
  callbackURL: '/api/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.use(new VKontakteStrategy({
  clientID: 'VK_CLIENT_ID',
  clientSecret: 'VK_CLIENT_SECRET',
  callbackURL: 'http://localhost:5000/api/auth/vk/callback'
}, function(accessToken, refreshToken, params, profile, done) {
  return done(null, profile);
}));