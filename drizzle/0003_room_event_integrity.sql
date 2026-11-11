CREATE UNIQUE INDEX room_reservation_pair ON room_reservations(room_id,id);
--> statement-breakpoint
CREATE TRIGGER room_event_reference_insert BEFORE INSERT ON room_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id) THEN RAISE(ABORT,'ROOM_EVENT_ROOM_MISSING') END;
 SELECT CASE WHEN NEW.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM room_reservations WHERE id=NEW.reservation_id AND room_id=NEW.room_id) THEN RAISE(ABORT,'ROOM_EVENT_RESERVATION_MISMATCH') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_event_reference_update BEFORE UPDATE OF room_id,reservation_id ON room_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id) THEN RAISE(ABORT,'ROOM_EVENT_ROOM_MISSING') END;
 SELECT CASE WHEN NEW.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM room_reservations WHERE id=NEW.reservation_id AND room_id=NEW.room_id) THEN RAISE(ABORT,'ROOM_EVENT_RESERVATION_MISMATCH') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_reservation_identity_immutable BEFORE UPDATE OF id,room_id ON room_reservations WHEN NEW.id<>OLD.id OR NEW.room_id<>OLD.room_id BEGIN
 SELECT RAISE(ABORT,'ROOM_RESERVATION_IDENTITY_IMMUTABLE');
END;
