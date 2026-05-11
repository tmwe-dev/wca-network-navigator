UPDATE public.shared_mailboxes
SET imap_host = 'mx01.vmteca.net',
    imap_port = 993,
    smtp_host = 'mx01.vmteca.net',
    smtp_port = 465,
    updated_at = now()
WHERE slug = 'booking';