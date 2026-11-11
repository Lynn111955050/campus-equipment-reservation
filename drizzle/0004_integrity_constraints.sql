-- Preserve all existing rows while adding explicit constraints. D1 applies the migration transactionally.
DROP INDEX one_out;
--> statement-breakpoint
DROP INDEX by_slot;
--> statement-breakpoint
DROP INDEX one_repair;
--> statement-breakpoint
DROP TRIGGER validate_book;
--> statement-breakpoint
DROP TRIGGER booked;
--> statement-breakpoint
DROP TRIGGER loan_event;
--> statement-breakpoint
DROP TRIGGER faulty;
--> statement-breakpoint
DROP INDEX room_slot_lookup;
--> statement-breakpoint
DROP INDEX room_student_lookup;
--> statement-breakpoint
DROP INDEX room_one_in_use;
--> statement-breakpoint
DROP TRIGGER room_booking_validate;
--> statement-breakpoint
DROP TRIGGER room_booking_log;
--> statement-breakpoint
DROP TRIGGER room_booking_transition;
--> statement-breakpoint
DROP TRIGGER room_booking_log_update;
--> statement-breakpoint
DROP TRIGGER room_disable_validate;
--> statement-breakpoint
DROP TRIGGER room_disable_cancel;
--> statement-breakpoint
DROP TRIGGER room_restore_log;
--> statement-breakpoint
DROP INDEX room_reservation_pair;
--> statement-breakpoint
DROP TRIGGER room_event_reference_insert;
--> statement-breakpoint
DROP TRIGGER room_event_reference_update;
--> statement-breakpoint
DROP TRIGGER room_reservation_identity_immutable;
--> statement-breakpoint
ALTER TABLE assets RENAME TO _v3_assets;
--> statement-breakpoint
ALTER TABLE loans RENAME TO _v3_loans;
--> statement-breakpoint
ALTER TABLE repairs RENAME TO _v3_repairs;
--> statement-breakpoint
ALTER TABLE audit RENAME TO _v3_audit;
--> statement-breakpoint
ALTER TABLE requests RENAME TO _v3_requests;
--> statement-breakpoint
ALTER TABLE sessions RENAME TO _v3_sessions;
--> statement-breakpoint
ALTER TABLE rooms RENAME TO _v3_rooms;
--> statement-breakpoint
ALTER TABLE room_reservations RENAME TO _v3_room_reservations;
--> statement-breakpoint
ALTER TABLE room_events RENAME TO _v3_room_events;
--> statement-breakpoint
CREATE TABLE assets(tag TEXT NOT NULL PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('相機','收音','腳架')),status TEXT NOT NULL DEFAULT '可借' CHECK(status IN ('可借','維修中')));
--> statement-breakpoint
CREATE TABLE loans(id TEXT NOT NULL PRIMARY KEY,tag TEXT NOT NULL REFERENCES assets(tag),student TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL CHECK(end>start),status TEXT NOT NULL DEFAULT '已預約' CHECK(status IN ('已預約','已取件','已歸還','已取消')),picked INTEGER,returned INTEGER,reason TEXT,actor TEXT NOT NULL,UNIQUE(tag,id));
--> statement-breakpoint
CREATE TABLE repairs(id TEXT NOT NULL PRIMARY KEY,tag TEXT NOT NULL REFERENCES assets(tag),loan TEXT NOT NULL UNIQUE REFERENCES loans(id),note TEXT NOT NULL,opened INTEGER NOT NULL,closed INTEGER,resolution TEXT,FOREIGN KEY(tag,loan) REFERENCES loans(tag,id));
--> statement-breakpoint
CREATE TABLE audit(id INTEGER PRIMARY KEY,tag TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,ref TEXT,at INTEGER NOT NULL DEFAULT(unixepoch()*1000));
--> statement-breakpoint
CREATE TABLE requests(actor TEXT NOT NULL,key TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(actor,key));
--> statement-breakpoint
CREATE TABLE sessions(token TEXT NOT NULL PRIMARY KEY,actor TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE rooms (
 id TEXT NOT NULL PRIMARY KEY,
 name TEXT NOT NULL,
 location TEXT NOT NULL,
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 300),
 projector INTEGER NOT NULL DEFAULT 0 CHECK(projector IN (0,1)),
 accessible INTEGER NOT NULL DEFAULT 0 CHECK(accessible IN (0,1)),
 status TEXT NOT NULL DEFAULT '開放' CHECK(status IN ('開放','停用')),
 note TEXT NOT NULL DEFAULT '',
 actor TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE room_reservations (
 id TEXT NOT NULL PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES rooms(id),
 student TEXT NOT NULL,
 start INTEGER NOT NULL,
 end INTEGER NOT NULL CHECK(end > start),
 people INTEGER NOT NULL CHECK(people BETWEEN 1 AND 300),
 purpose TEXT NOT NULL CHECK(length(purpose) BETWEEN 5 AND 200),
 status TEXT NOT NULL DEFAULT '已預約' CHECK(status IN ('已預約','使用中','已結束','已取消','未簽到')),
 checked_in INTEGER,
 finished INTEGER,
 reason TEXT,
 created INTEGER NOT NULL,
 actor TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE room_events (
 id INTEGER PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES rooms(id),
 reservation_id TEXT REFERENCES room_reservations(id),
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 at INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO assets SELECT * FROM _v3_assets;
--> statement-breakpoint
INSERT INTO loans SELECT * FROM _v3_loans;
--> statement-breakpoint
INSERT INTO repairs SELECT * FROM _v3_repairs;
--> statement-breakpoint
INSERT INTO audit SELECT * FROM _v3_audit;
--> statement-breakpoint
INSERT INTO requests SELECT * FROM _v3_requests;
--> statement-breakpoint
INSERT INTO sessions SELECT * FROM _v3_sessions;
--> statement-breakpoint
INSERT INTO rooms SELECT * FROM _v3_rooms;
--> statement-breakpoint
INSERT INTO room_reservations SELECT * FROM _v3_room_reservations;
--> statement-breakpoint
INSERT INTO room_events SELECT * FROM _v3_room_events;
--> statement-breakpoint
DROP TABLE _v3_room_events;
--> statement-breakpoint
DROP TABLE _v3_repairs;
--> statement-breakpoint
DROP TABLE _v3_loans;
--> statement-breakpoint
DROP TABLE _v3_room_reservations;
--> statement-breakpoint
DROP TABLE _v3_rooms;
--> statement-breakpoint
DROP TABLE _v3_assets;
--> statement-breakpoint
DROP TABLE _v3_audit;
--> statement-breakpoint
DROP TABLE _v3_requests;
--> statement-breakpoint
DROP TABLE _v3_sessions;
--> statement-breakpoint
CREATE UNIQUE INDEX one_out ON loans(tag) WHERE status='已取件';
--> statement-breakpoint
CREATE INDEX by_slot ON loans(tag,start,end);
--> statement-breakpoint
CREATE UNIQUE INDEX one_repair ON repairs(tag) WHERE closed IS NULL;
--> statement-breakpoint
CREATE TRIGGER validate_book BEFORE INSERT ON loans BEGIN
 SELECT CASE WHEN (SELECT status FROM assets WHERE tag=NEW.tag) IS NOT '可借' THEN RAISE(ABORT,'ASSET_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM loans WHERE tag=NEW.tag AND status<>'已取消' AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'SLOT_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER booked AFTER INSERT ON loans BEGIN
 INSERT INTO audit(tag,actor,action,ref) VALUES(NEW.tag,NEW.actor,'建立預約',NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER loan_event AFTER UPDATE OF status ON loans WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO audit(tag,actor,action,ref) VALUES(NEW.tag,NEW.actor,NEW.status,NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER faulty AFTER INSERT ON repairs BEGIN
 UPDATE assets SET status='維修中' WHERE tag=NEW.tag;
 UPDATE loans SET status='已取消',reason='器材故障停借',actor=(SELECT actor FROM loans WHERE id=NEW.loan) WHERE tag=NEW.tag AND status='已預約' AND start+900000>NEW.opened;
 INSERT INTO audit(tag,actor,action,ref) SELECT NEW.tag,actor,'故障停借',NEW.id FROM loans WHERE id=NEW.loan;
END;
--> statement-breakpoint
CREATE INDEX room_slot_lookup ON room_reservations(room_id,start,end);
--> statement-breakpoint
CREATE INDEX room_student_lookup ON room_reservations(student,start);
--> statement-breakpoint
CREATE UNIQUE INDEX room_one_in_use ON room_reservations(room_id) WHERE status='使用中';
--> statement-breakpoint
CREATE TRIGGER room_booking_validate BEFORE INSERT ON room_reservations BEGIN
 SELECT CASE WHEN NEW.status <> '已預約' THEN RAISE(ABORT,'ROOM_STATE') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND status='開放') THEN RAISE(ABORT,'ROOM_CLOSED') END;
 SELECT CASE WHEN NEW.people > (SELECT capacity FROM rooms WHERE id=NEW.room_id) THEN RAISE(ABORT,'ROOM_CAPACITY') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM room_reservations WHERE room_id=NEW.room_id AND status IN ('已預約','使用中','已結束') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM room_reservations WHERE student=NEW.student AND status IN ('已預約','使用中') AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'STUDENT_CONFLICT') END;
 SELECT CASE WHEN (SELECT count(*) FROM room_reservations WHERE student=NEW.student AND status IN ('已預約','使用中') AND end>NEW.created)>=3 THEN RAISE(ABORT,'ROOM_QUOTA') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_booking_log AFTER INSERT ON room_reservations BEGIN
 INSERT INTO room_events(room_id,reservation_id,actor,action,at) VALUES(NEW.room_id,NEW.id,NEW.actor,'建立預約',NEW.created);
END;
--> statement-breakpoint
CREATE TRIGGER room_booking_transition BEFORE UPDATE OF status ON room_reservations WHEN OLD.status<>NEW.status BEGIN
 SELECT CASE WHEN NOT ((OLD.status='已預約' AND NEW.status IN ('使用中','已取消','未簽到')) OR (OLD.status='使用中' AND NEW.status='已結束')) THEN RAISE(ABORT,'ROOM_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_booking_log_update AFTER UPDATE OF status ON room_reservations WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO room_events(room_id,reservation_id,actor,action,at) VALUES(NEW.room_id,NEW.id,NEW.actor,NEW.status,coalesce(NEW.finished,NEW.checked_in,unixepoch()*1000));
END;
--> statement-breakpoint
CREATE TRIGGER room_disable_validate BEFORE UPDATE OF status ON rooms WHEN NEW.status='停用' AND OLD.status<>NEW.status BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM room_reservations WHERE room_id=NEW.id AND status='使用中') THEN RAISE(ABORT,'ROOM_OCCUPIED') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_disable_cancel AFTER UPDATE OF status ON rooms WHEN NEW.status='停用' AND OLD.status<>NEW.status BEGIN
 UPDATE room_reservations SET status='已取消',reason='教室停用：'||NEW.note,actor=NEW.actor WHERE room_id=NEW.id AND status='已預約';
 INSERT INTO room_events(room_id,actor,action,at) VALUES(NEW.id,NEW.actor,'停用教室',unixepoch()*1000);
END;
--> statement-breakpoint
CREATE TRIGGER room_restore_log AFTER UPDATE OF status ON rooms WHEN NEW.status='開放' AND OLD.status<>NEW.status BEGIN
 INSERT INTO room_events(room_id,actor,action,at) VALUES(NEW.id,NEW.actor,'開放教室',unixepoch()*1000);
END;
--> statement-breakpoint
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
