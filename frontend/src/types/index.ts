// Event/Gallery types
export interface Event {
  id: number;
  slug: string;
  event_type: string;
  event_name: string;
  event_date: string;
  host_name?: string;
  host_email: string;
  admin_email: string;
  welcome_message?: string;
  color_theme?: string;
  share_link: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  is_archived: boolean;
  archive_path?: string;
  archived_at?: string;
  photo_count?: number;
  total_size?: number;
  recent_photos?: Array<{
    filename: string;
    type: string;
    size_bytes: number;
    uploaded_at: string;
  }>;
  allow_user_uploads?: boolean;
  upload_category_id?: number | null;
  hero_photo_id?: number | null;
  total_views?: number;
  total_downloads?: number;
  unique_visitors?: number;
}

export interface GalleryInfo {
  event_name: string;
  event_type: string;
  event_date: string;
  expires_at: string;
  is_active: boolean;
  is_expired: boolean;
  requires_password?: boolean;
  color_theme?: string;
}

export interface Photo {
  id: number;
  filename: string;
  url: string;
  thumbnail_url?: string;
  type: 'collage' | 'individual';
  category_id?: number;
  category_name?: string;
  category_slug?: string;
  size: number;
  uploaded_at: string;
}

export interface PhotoCategory {
  id: number;
  name: string;
  slug: string;
  is_global: boolean;
}

export interface GalleryData {
  event: {
    id: number;
    event_name: string;
    event_type: string;
    event_date: string;
    welcome_message?: string;
    color_theme?: string;
    expires_at: string;
    allow_user_uploads?: boolean;
    upload_category_id?: number | null;
    hero_photo_id?: number | null;
  };
  categories?: PhotoCategory[];
  photos: Photo[];
}

export interface GalleryStats {
  total_photos: number;
  total_views: number;
  total_downloads: number;
  unique_visitors: number;
}

// Auth types
export interface AdminUser {
  id: number;
  username: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

export interface GalleryAuthResponse {
  token: string;
  event: {
    id: number;
    event_name: string;
    event_type: string;
    event_date: string;
    welcome_message?: string;
    color_theme?: string;
    expires_at: string;
    allow_user_uploads?: boolean;
    upload_category_id?: number | null;
  };
}

// API Error type
export interface ApiError {
  error: string;
  errors?: Array<{
    type: string;
    msg: string;
    path: string;
    location: string;
  }>;
}