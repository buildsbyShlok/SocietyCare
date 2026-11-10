const { v2: cloudinary } = require('cloudinary');
const ApiError = require('../utils/ApiError');

/**
 * Cloudinary client — configured once at startup.
 *
 * Used in upload middleware to stream photo uploads directly
 * from Multer memory storage to Cloudinary (no disk writes).
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
});

cloudinary.assertConfigured = () => {
  const config = cloudinary.config();
  if (![config.cloud_name, config.api_key, config.api_secret].every((value) => value?.trim())) {
    throw new ApiError(503, 'Image uploads are unavailable. Cloudinary is not configured. Submit without an image or contact your administrator.');
  }
};

module.exports = cloudinary;
