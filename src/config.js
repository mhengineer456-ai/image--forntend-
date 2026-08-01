// Central API Configuration
// When deploying to Vercel/Netlify, set VITE_BACKEND_URL in environment variables (e.g. https://your-backend.onrender.com)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
