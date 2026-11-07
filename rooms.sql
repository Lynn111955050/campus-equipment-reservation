CREATE TABLE rooms (
 id TEXT PRIMARY KEY,
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
 id TEXT PRIMARY KEY,
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
CREATE INDEX room_slot_lookup ON room_reservations(room_id,start,end);
--> statement-breakpoint
CREATE INDEX room_student_lookup ON room_reservations(student,start);
--> statement-breakpoint
CREATE UNIQUE INDEX room_one_in_use ON room_reservations(room_id) WHERE status='使用中';
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
