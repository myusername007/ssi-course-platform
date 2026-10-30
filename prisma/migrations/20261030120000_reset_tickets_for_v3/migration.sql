-- TicketRegistry v3 (isVerified now also checks the identity record's hash)
-- is a new deployment, so its ticket ids start again from 1. Tickets cached
-- so far belong to v2 and would point at tickets that do not exist there.
DELETE FROM "Ticket";
