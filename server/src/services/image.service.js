const cloudinary = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");
function validateImage(file) {
  const b = file?.buffer;
  if (!Buffer.isBuffer(b) || !b.length) throw new ApiError(400, "Choose a valid image file.");
  const png =
    b.length > 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    b.length > 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP";
  if (
    !{ "image/png": png, "image/jpeg": jpeg, "image/webp": webp }[file.mimetype]
  )
    throw new ApiError(
      400,
      "The file content does not match a supported image.",
    );
}
function uploadError(error) {
  const status = Number(error?.http_code);
  if ([401, 403].includes(status))
    return new ApiError(503, "Image storage rejected its configuration. Contact the administrator.");
  if (status === 420 || status === 429)
    return new ApiError(429, "Image storage is busy. Please try again shortly.");
  if (status === 400)
    return new ApiError(400, "Image storage could not process this image. Choose a valid JPEG, PNG or WebP file.");
  return new ApiError(502, "Image upload failed. Try again or submit without an image.");
}
async function uploadImage(file, folder) {
  if (!file) return undefined;
  validateImage(file);
  const limitMb = folder === "avatars" ? 2 : 5;
  if (file.buffer.length > limitMb * 1024 * 1024)
    throw new ApiError(400, "Image exceeds the " + limitMb + " MB size limit.");
  cloudinary.assertConfigured();
  return new Promise((resolve, reject) => {
    let stream, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) return reject(error);
      if (!result?.secure_url?.startsWith("https://") || !result.public_id)
        return reject(uploadError());
      resolve({ url: result.secure_url, publicId: result.public_id });
    };
    const timer = setTimeout(() => {
      finish(new ApiError(504, "Image upload timed out. Please retry."));
      stream?.destroy();
    }, 30000);
    try {
      stream = cloudinary.uploader.upload_stream(
        { folder: "society-maintenance/" + folder, resource_type: "image", timeout: 30000 },
        (error, result) => finish(error ? uploadError(error) : null, result),
      );
      stream.on("error", () => finish(uploadError()));
      stream.end(file.buffer);
    } catch {
      finish(uploadError());
    }
  });
}
module.exports = { uploadImage, validateImage };
