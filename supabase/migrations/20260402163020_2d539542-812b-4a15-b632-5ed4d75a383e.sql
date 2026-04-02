UPDATE email_sync_state SET last_uid = 0, last_sync_at = NULL;
DELETE FROM channel_messages WHERE channel = 'email';