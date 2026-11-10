// Resolve relative to the server, regardless of the shell's working directory.
// Existing deployment environment variables retain precedence over .env.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
