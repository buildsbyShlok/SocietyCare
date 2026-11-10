/**
 * validateEnv.js — Environment variable validation for server bootstrap.
 *
 * Checks core required configuration settings (DATABASE_URL, JWT_SECRET, CLIENT_URL).
 * If any core configuration is missing, it logs a fatal error and terminates startup.
 *
 * External services (Groq AI, Cloudinary, Resend) are optional for local development
 * and testing. When absent, clear warnings are logged without terminating the process.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLIENT_URL',
];

const OPTIONAL_INTEGRATIONS = [
  {
    name: 'Groq AI (Complaint Assistant)',
    keys: ['GROQ_API_KEY'],
    warning: 'AI analysis and suggestions will be disabled.',
  },
  {
    name: 'Cloudinary (Photo Attachments & Avatars)',
    keys: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    warning: 'Image attachments and avatar uploads will fail if attempted.',
  },
  {
    name: 'Resend (Email Notifications)',
    keys: ['RESEND_API_KEY', 'FROM_EMAIL'],
    warning: 'Email notifications for status changes and pinned notices will be skipped.',
  },
];

function validateEnv() {
  const missingRequired = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key] || process.env[key].trim().length === 0) {
      missingRequired.push(key);
    }
  }

  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32))
    missingRequired.push('JWT_SECRET (at least 32 characters in production)');
  if (missingRequired.length > 0) {
    console.error('\n❌ FATAL STARTUP ERROR: Missing required environment variables:');
    for (const key of missingRequired) {
      console.error(`  - ${key}`);
    }
    console.error('\nPlease declare these environment variables inside .env file or host environment config to run the application.\n');
    process.exit(1);
  }

  // Check optional integrations and log helpful warnings without crashing
  const warnings = [];
  for (const integration of OPTIONAL_INTEGRATIONS) {
    const missingKeys = integration.keys.filter(
      (k) => !process.env[k] || process.env[k].trim().length === 0
    );

    if (missingKeys.length > 0) {
      warnings.push(`  - ${integration.name}: missing [${missingKeys.join(', ')}]. ${integration.warning}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️ OPTIONAL INTEGRATIONS NOTICE (Local Development / Testing):');
    for (const w of warnings) {
      console.warn(w);
    }
    console.warn('The application will run; unavailable integrations return errors or skip email delivery. No mock data is used.\n');
  }
}

module.exports = validateEnv;
