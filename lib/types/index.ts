export interface File {
  id: string
  original_name: string
  storage_path: string
  mime_type: string
  size: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Recipient {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

export interface DownloadLink {
  id: string
  code: string
  recipient_id: string
  file_id: string
  active: boolean
  access_count: number
  download_count: number
  created_at: string
  updated_at: string
  recipient?: Recipient
  file?: File
}

export interface DownloadEvent {
  id: string
  download_link_id: string
  recipient_id: string | null
  file_id: string | null
  event_type: 'link_open' | 'button_click' | 'download_start' | 'download_complete' | 'download_blocked' | 'invalid_link' | 'inactive_link'
  ip_address: string | null
  country: string | null
  region: string | null
  city: string | null
  timezone: string | null
  provider: string | null
  organization: string | null
  device_type: 'desktop' | 'mobile' | 'tablet' | 'other'
  operating_system: string | null
  browser: string | null
  browser_version: string | null
  user_agent: string | null
  referer: string | null
  created_at: string
}

export interface DownloadStats {
  total_links: number
  total_accesses: number
  total_downloads: number
  most_accessed_file: {
    name: string
    count: number
  } | null
  most_accessed_recipient: {
    name: string
    count: number
  } | null
  events_by_type: Record<string, number>
  events_by_device: Record<string, number>
  events_by_browser: Record<string, number>
  events_by_country: Record<string, number>
}

export interface RecipientStats {
  recipient_id: string
  recipient_name: string
  recipient_email: string
  total_links: number
  total_accesses: number
  total_downloads: number
  active_links: number
  files: Array<{
    file_id: string
    file_name: string
    access_count: number
    download_count: number
  }>
}
