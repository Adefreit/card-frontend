/**
 * Configuration Settings
 */
export const config = {
  UPLOADS: {
    MAX_UPLOAD_SIZE: 3 * 1024 * 1024,
  },
  CARDS: {
    DEFAULT_PREVIEW_DPI: 150,
    DEFAULT_PROOF_DPI: 300,
    WIDTH_INCHES: 2.44,
    HEIGHT_INCHES: 3.67,
  },
  URLS: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL ?? "http://localhost:5173",
  },
};
