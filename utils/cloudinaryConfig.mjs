/**
 * SINGLE SOURCE OF TRUTH for Cloudinary preset settings
 * Change these values once, and they apply everywhere (upload, delivery, client, server)
 */

export const CLOUDINARY_PRESETS = {
  fine: {
    quality: 80,
    width: 1000
  },
  ultra: {
    quality: 90,
    width: 1600
  }
};

export const CLOUDINARY_CONFIG = {
  format: 'webp',
  crop: 'limit',
  dprs: [1.0, 2.0]
};
