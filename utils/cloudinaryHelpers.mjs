/**
 * Shared Cloudinary utilities for image upload and transformation
 * Used across netlify functions and scripts to avoid duplication
 */

/**
 * Transformation presets for eager generation
 * Generates 8 variants: 2 widths × 2 qualities × 2 DPRs × 1 format
 */
export const TRANSFORMATION_PRESETS = {
  widths: [800, 1600],
  qualities: [90, 75],  // ultra, fine
  dprs: [1.0, 2.0],
  format: 'webp'
};

/**
 * Generate all eager transformation combinations
 * @returns {Array} Array of transformation objects (8 variants)
 */
export const generateEagerTransformations = () => {
  const transformations = [];
  
  for (const width of TRANSFORMATION_PRESETS.widths) {
    for (const quality of TRANSFORMATION_PRESETS.qualities) {
      for (const dpr of TRANSFORMATION_PRESETS.dprs) {
        transformations.push({
          width,
          quality,
          dpr,
          crop: 'limit',
          format: TRANSFORMATION_PRESETS.format
        });
      }
    }
  }
  
  return transformations;
};

/**
 * Upload image to Cloudinary with optional eager transformations
 * 
 * Note: Eager transformations are disabled by default for faster uploads.
 * Transformations are generated on-demand (first request has ~2-3s delay).
 * 
 * @param {Object} cloudinary - Configured Cloudinary instance
 * @param {string} imageUrl - Source image URL to upload
 * @param {string} publicId - Public ID for the uploaded image
 * @param {Object} options - Upload options
 * @param {string} options.title - Image title (for metadata)
 * @param {boolean} options.eager - Whether to pre-generate transformations (default: false)
 * @param {number} options.quality - Upload quality (default: 100)
 * @param {boolean} options.overwrite - Whether to overwrite existing (default: true)
 * @returns {Promise<Object>} Upload result with success status and metadata
 */
export const uploadToCloudinary = async (cloudinary, imageUrl, publicId, options = {}) => {
  const {
    title = '',
    eager = false, // Disabled by default for faster uploads
    quality = 100,
    overwrite = true
  } = options;
  
  const uploadOptions = {
    public_id: publicId,
    folder: '', // Already in public_id
    resource_type: 'image',
    format: 'webp',
    quality,
    overwrite
  };
  
  // Add eager transformations if explicitly enabled
  // Note: Adds ~6-8 seconds per image upload but eliminates cold-start delays
  if (eager) {
    uploadOptions.eager = generateEagerTransformations();
    uploadOptions.eager_async = false;
  }
  
  try {
    const result = await cloudinary.uploader.upload(imageUrl, uploadOptions);
    
    return {
      success: true,
      publicId: result.public_id,
      cloudinaryUrl: result.secure_url,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    console.error(`Failed to upload ${publicId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Configure Cloudinary instance with environment credentials
 * 
 * @param {Object} cloudinary - Cloudinary SDK instance
 * @param {Object} credentials - Cloudinary credentials
 * @param {string} credentials.cloudName - Cloud name
 * @param {string} credentials.apiKey - API key
 * @param {string} credentials.apiSecret - API secret
 * @returns {boolean} Whether configuration was successful
 */
export const configureCloudinary = (cloudinary, credentials) => {
  const { cloudName, apiKey, apiSecret } = credentials;
  
  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('⚠️ Missing Cloudinary credentials');
    return false;
  }
  
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  
  console.log(`✅ Cloudinary configured: ${cloudName}`);
  return true;
};
