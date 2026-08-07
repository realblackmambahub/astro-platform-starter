-- MIGRATION REQUIRED FOR EVENT SYSTEM
-- 
-- This migration must be run in your Supabase SQL Editor to enable the event system.
-- Copy ALL lines below and paste into: https://app.supabase.com → SQL Editor
--
-- ==============================================================================

-- 1. Fix event_type constraint to accept 'access' and 'download'
ALTER TABLE download_events
DROP CONSTRAINT IF EXISTS download_events_event_type_check;

ALTER TABLE download_events
ADD CONSTRAINT download_events_event_type_check 
CHECK (event_type IN ('access', 'download'));

-- 2. Create RPC function to atomically increment access_count
CREATE OR REPLACE FUNCTION increment_access_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE download_links
  SET access_count = access_count + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC function to atomically increment download_count
CREATE OR REPLACE FUNCTION increment_download_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE download_links
  SET download_count = download_count + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 
-- After running this migration:
-- 1. The event system will start registering access and download events
-- 2. Counters will update automatically
-- 3. The diagnostic endpoint will confirm everything is working
--
-- Verify:
-- GET http://localhost:3000/api/debug/events
--
-- Look for:
-- - "supabaseConnected": true
-- - "tables.download_events": true
-- - "columns.eventTypeColumn": "event_type"
-- - "rpc.incrementAccessAvailable": true
-- - "rpc.incrementDownloadAvailable": true
--
-- ==============================================================================
