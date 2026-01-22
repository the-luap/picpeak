// Event/Gallery types
export interface Event {
  id: number;
  slug: string;
  event_type: string;
  event_name: string;
  event_date: string | null;
  customer_name?: string;
  customer_email: string;
  admin_email: string;
  welcome_message?: string;
  color_theme?: string;
  share_link: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_archived: boolean;
  archive_path?: string;
  archived_at?: string;
  require_password?: boolean;
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
  source_mode?: 'managed' | 'reference' | string;
  external_path?: string | null;
  // Download protection fields
  allow_downloads?: boolean;
  protection_level?: 'basic' | 'standard' | 'enhanced' | 'maximum';
  disable_right_click?: boolean;
  watermark_downloads?: boolean;
  enable_devtools_protection?: boolean;
  use_canvas_rendering?: boolean;
  // Hero logo customization fields
  hero_logo_visible?: boolean;
  hero_logo_size?: 'small' | 'medium' | 'large' | 'xlarge';
  hero_logo_position?: 'top' | 'center' | 'bottom';
}

export interface GalleryInfo {
  event_name: string;
  event_type: string;
  event_date: string | null;
  expires_at: string | null;
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
  secure_url_template?: string;
  download_url_template?: string;
  requires_token?: boolean;
  type: 'collage' | 'individual' | 'video';
  category_id?: number | string | null;
  category_name?: string;
  category_slug?: string;
  size: number;
  uploaded_at: string;
  // Media type fields
  media_type?: 'photo' | 'video' | 'image';
  mime_type?: string;
  duration?: number; // Duration in seconds for videos
  video_codec?: string;
  audio_codec?: string;
  width?: number;
  height?: number;
  // Feedback fields
  has_feedback?: boolean;
  average_rating?: number;
  total_ratings?: number;
  comment_count?: number;
  like_count?: number;
  favorite_count?: number;
}

export interface PhotoCategory {
  id: number | string;
  name: string;
  slug: string;
  is_global: boolean;
}

export interface GalleryData {
  event: {
    id: number;
    event_name: string;
    event_type: string;
    event_date: string | null;
    welcome_message?: string;
    color_theme?: string;
    expires_at: string | null;
    allow_user_uploads?: boolean;
    upload_category_id?: number | null;
    hero_photo_id?: number | null;
    allow_downloads?: boolean;
    disable_right_click?: boolean;
    watermark_downloads?: boolean;
    watermark_text?: string;
    require_password?: boolean;
    protection_level?: 'basic' | 'standard' | 'enhanced' | 'maximum';
    image_quality?: number;
    use_canvas_rendering?: boolean;
    enable_devtools_protection?: boolean;
    fragmentation_level?: number;
    overlay_protection?: boolean;
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

export interface ResolvedGalleryIdentifier {
  slug: string;
  token: string;
  matchType: string;
  share_link: string;
  share_path: string;
  share_url: string;
  short_enabled: boolean;
  requires_password: boolean;
}

// Auth types
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  mustChangePassword?: boolean;
  role?: {
    name: string;
    displayName: string;
  };
  roleId?: number;
  roleName?: string;
  roleDisplayName?: string;
  isActive?: boolean;
  lastLogin?: string | null;
  lastLoginIp?: string | null;
  createdAt?: string;
  createdByUsername?: string;
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
    require_password?: boolean;
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

// Role and Permission types
export interface AdminRole {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  isSystem?: boolean;
  priority?: number;
}

export interface AdminPermissions {
  role: {
    name: string;
    displayName: string;
  } | null;
  permissions: string[];
}

export interface AdminInvitation {
  id: number;
  email: string;
  roleName: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

// Export protection types
export * from './protection';
