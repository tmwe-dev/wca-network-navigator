DELETE FROM email_attachments;
DELETE FROM channel_messages WHERE channel = 'email';
UPDATE email_sync_state SET last_uid = 0;