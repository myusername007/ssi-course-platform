-- All events are online now: the join link is stored per event and only
-- handed out by the server after an on-chain ticket check.
ALTER TABLE "Event" ADD COLUMN "meetingUrl" TEXT;

-- Tickets cached so far belong to the first TicketRegistry deployment (v1).
-- The service moves to v2, whose ticket ids start again from 1, so the old
-- rows would point at tickets that do not exist there.
DELETE FROM "Ticket";
