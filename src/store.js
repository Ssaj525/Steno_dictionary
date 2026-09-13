import { createClient } from '@supabase/supabase-js';

// Pre-configured Credentials
export const HARDCODED_ADMIN_PASS = 'Stenokapagal@2005';
export const DEFAULT_SUPABASE_URL = 'https://nkrzevlmlkmwtbgumxcw.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcnpldmxtbGttd3RiZ3VteGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODY2MzIsImV4cCI6MjEwNDg2MjYzMn0.gFca2iuwT5M7buSKaGOhQrWzWXfSLpI4yZQq9KpGwOY';
export const DEFAULT_CLOUDINARY_CLOUD = 'o0isvtvi';
export const DEFAULT_CLOUDINARY_PRESET = 'steno_preset';

// Sample dataset sorted alphabetically
export const INITIAL_DATA = [
  {
    id: '1',
    english_meaning: 'Accountant',
    image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: false
  },
  {
    id: '2',
    english_meaning: 'Business',
    image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: true
  },
  {
    id: '3',
    english_meaning: 'Create',
    image_url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: false
  },
  {
    id: '4',
    english_meaning: 'Dictionary',
    image_url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: false
  },
  {
    id: '5',
    english_meaning: 'Execution',
    image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: false
  },
  {
    id: '6',
    english_meaning: 'Knowledge',
    image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
    is_word_of_day: false
  }
];

export function getSavedConfig() {
  return {
    supabaseUrl: localStorage.getItem('steno_sb_url') || DEFAULT_SUPABASE_URL,
    supabaseKey: localStorage.getItem('steno_sb_key') || DEFAULT_SUPABASE_KEY,
    cloudinaryCloudName: localStorage.getItem('steno_cld_name') || DEFAULT_CLOUDINARY_CLOUD,
    cloudinaryUploadPreset: localStorage.getItem('steno_cld_preset') || DEFAULT_CLOUDINARY_PRESET
  };
}

export function saveConfig(config) {
  if (config.supabaseUrl) localStorage.setItem('steno_sb_url', config.supabaseUrl);
  if (config.supabaseKey) localStorage.setItem('steno_sb_key', config.supabaseKey);
  if (config.cloudinaryCloudName) localStorage.setItem('steno_cld_name', config.cloudinaryCloudName);
  if (config.cloudinaryUploadPreset) localStorage.setItem('steno_cld_preset', config.cloudinaryUploadPreset);
}

export function getSupabaseClient() {
  const cfg = getSavedConfig();
  if (cfg.supabaseUrl && cfg.supabaseKey) {
    try {
      return createClient(cfg.supabaseUrl, cfg.supabaseKey);
    } catch (e) {
      console.warn('Supabase client error:', e);
    }
  }
  return null;
}

export async function uploadImageToCloudinary(file) {
  const cfg = getSavedConfig();
  if (cfg.cloudinaryCloudName && cfg.cloudinaryUploadPreset) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cfg.cloudinaryUploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudinaryCloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.secure_url;
    } else {
      const err = await res.json();
      throw new Error(err.error?.message || 'Cloudinary upload failed. Please create the unsigned upload preset "steno_preset" in your Cloudinary Dashboard.');
    }
  }

  throw new Error('Cloudinary credentials incomplete.');
}
