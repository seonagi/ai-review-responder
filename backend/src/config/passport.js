// Passport configuration for Google OAuth
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Initialize passport with Google OAuth strategy
const initializePassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        scope: [
          'profile',
          'email',
          'https://www.googleapis.com/auth/business.manage'
        ],
        accessType: 'offline', // Get refresh token
        prompt: 'consent' // Force consent screen to get refresh token
      },
      async (accessToken, refreshToken, profile, done) => {
        // This callback is called after successful authentication
        // We'll pass tokens and profile to the route handler
        return done(null, {
          profile,
          accessToken,
          refreshToken
        });
      }
    )
  );

  // Serialize user (required by Passport, but we use JWT so we can keep it minimal)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
};

module.exports = initializePassport;
