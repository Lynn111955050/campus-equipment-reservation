CREATE TABLE users (
 id TEXT NOT NULL PRIMARY KEY,
 account TEXT NOT NULL UNIQUE,
 role TEXT NOT NULL CHECK(role IN ('學生','櫃台','管理員','系統')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE loans ADD COLUMN student_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER loans_student_link_insert AFTER INSERT ON loans BEGIN
 UPDATE loans SET student_id=(SELECT id FROM users WHERE account=NEW.student) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER loans_student_link_update AFTER UPDATE OF student ON loans BEGIN
 UPDATE loans SET student_id=(SELECT id FROM users WHERE account=NEW.student) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER loans_student_id_guard BEFORE UPDATE OF student_id ON loans
 WHEN NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.student_id AND account=NEW.student) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE loans ADD COLUMN actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER loans_actor_link_insert AFTER INSERT ON loans BEGIN
 UPDATE loans SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER loans_actor_link_update AFTER UPDATE OF actor ON loans BEGIN
 UPDATE loans SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER loans_actor_id_guard BEFORE UPDATE OF actor_id ON loans
 WHEN NEW.actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE rooms ADD COLUMN actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER rooms_actor_link_insert AFTER INSERT ON rooms BEGIN
 UPDATE rooms SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER rooms_actor_link_update AFTER UPDATE OF actor ON rooms BEGIN
 UPDATE rooms SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER rooms_actor_id_guard BEFORE UPDATE OF actor_id ON rooms
 WHEN NEW.actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE room_reservations ADD COLUMN student_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER room_reservations_student_link_insert AFTER INSERT ON room_reservations BEGIN
 UPDATE room_reservations SET student_id=(SELECT id FROM users WHERE account=NEW.student) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_reservations_student_link_update AFTER UPDATE OF student ON room_reservations BEGIN
 UPDATE room_reservations SET student_id=(SELECT id FROM users WHERE account=NEW.student) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_reservations_student_id_guard BEFORE UPDATE OF student_id ON room_reservations
 WHEN NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.student_id AND account=NEW.student) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE room_reservations ADD COLUMN actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER room_reservations_actor_link_insert AFTER INSERT ON room_reservations BEGIN
 UPDATE room_reservations SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_reservations_actor_link_update AFTER UPDATE OF actor ON room_reservations BEGIN
 UPDATE room_reservations SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_reservations_actor_id_guard BEFORE UPDATE OF actor_id ON room_reservations
 WHEN NEW.actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE room_events ADD COLUMN actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER room_events_actor_link_insert AFTER INSERT ON room_events BEGIN
 UPDATE room_events SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_events_actor_link_update AFTER UPDATE OF actor ON room_events BEGIN
 UPDATE room_events SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER room_events_actor_id_guard BEFORE UPDATE OF actor_id ON room_events
 WHEN NEW.actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE audit ADD COLUMN actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER audit_actor_link_insert AFTER INSERT ON audit BEGIN
 UPDATE audit SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER audit_actor_link_update AFTER UPDATE OF actor ON audit BEGIN
 UPDATE audit SET actor_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER audit_actor_id_guard BEFORE UPDATE OF actor_id ON audit
 WHEN NEW.actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER sessions_actor_link_insert AFTER INSERT ON sessions BEGIN
 UPDATE sessions SET user_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER sessions_actor_link_update AFTER UPDATE OF actor ON sessions BEGIN
 UPDATE sessions SET user_id=(SELECT id FROM users WHERE account=NEW.actor) WHERE rowid=NEW.rowid;
END;
--> statement-breakpoint
CREATE TRIGGER sessions_actor_id_guard BEFORE UPDATE OF user_id ON sessions
 WHEN NEW.user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND account=NEW.actor) BEGIN
 SELECT RAISE(ABORT,'USER_ACCOUNT_MISMATCH');
END;
--> statement-breakpoint
ALTER TABLE audit ADD COLUMN loan_id TEXT REFERENCES loans(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE audit ADD COLUMN repair_id TEXT REFERENCES repairs(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE TRIGGER audit_typed_reference_insert BEFORE INSERT ON audit BEGIN
 SELECT CASE WHEN NEW.loan_id IS NOT NULL AND (NEW.repair_id IS NOT NULL OR NEW.ref IS NOT NEW.loan_id OR NEW.action NOT IN ('建立預約','已預約','已取消','已取件','已歸還')) THEN RAISE(ABORT,'AUDIT_REFERENCE_MISMATCH') END;
 SELECT CASE WHEN NEW.repair_id IS NOT NULL AND (NEW.ref IS NOT NEW.repair_id OR NEW.action NOT IN ('故障停借','維修結案')) THEN RAISE(ABORT,'AUDIT_REFERENCE_MISMATCH') END;
 SELECT CASE WHEN NEW.ref IS NOT NULL AND NEW.action IN ('建立預約','已預約','已取消','已取件','已歸還') AND NOT EXISTS(SELECT 1 FROM loans WHERE id=NEW.ref AND tag=NEW.tag) THEN RAISE(ABORT,'AUDIT_LOAN_MISSING') END;
 SELECT CASE WHEN NEW.ref IS NOT NULL AND NEW.action IN ('故障停借','維修結案') AND NOT EXISTS(SELECT 1 FROM repairs WHERE id=NEW.ref AND tag=NEW.tag) THEN RAISE(ABORT,'AUDIT_REPAIR_MISSING') END;
END;
--> statement-breakpoint
CREATE TRIGGER audit_typed_reference_update BEFORE UPDATE OF ref,action,loan_id,repair_id ON audit BEGIN
 SELECT CASE WHEN NEW.loan_id IS NOT NULL AND (NEW.repair_id IS NOT NULL OR NEW.ref IS NOT NEW.loan_id OR NEW.action NOT IN ('建立預約','已預約','已取消','已取件','已歸還')) THEN RAISE(ABORT,'AUDIT_REFERENCE_MISMATCH') END;
 SELECT CASE WHEN NEW.repair_id IS NOT NULL AND (NEW.ref IS NOT NEW.repair_id OR NEW.action NOT IN ('故障停借','維修結案')) THEN RAISE(ABORT,'AUDIT_REFERENCE_MISMATCH') END;
 SELECT CASE WHEN NEW.ref IS NOT NULL AND NEW.action IN ('建立預約','已預約','已取消','已取件','已歸還') AND NOT EXISTS(SELECT 1 FROM loans WHERE id=NEW.ref AND tag=NEW.tag) THEN RAISE(ABORT,'AUDIT_LOAN_MISSING') END;
 SELECT CASE WHEN NEW.ref IS NOT NULL AND NEW.action IN ('故障停借','維修結案') AND NOT EXISTS(SELECT 1 FROM repairs WHERE id=NEW.ref AND tag=NEW.tag) THEN RAISE(ABORT,'AUDIT_REPAIR_MISSING') END;
END;
--> statement-breakpoint
CREATE TRIGGER audit_link_typed_reference AFTER INSERT ON audit BEGIN
 UPDATE audit SET loan_id=CASE WHEN NEW.action IN ('建立預約','已預約','已取消','已取件','已歸還') THEN NEW.ref ELSE NULL END,
 repair_id=CASE WHEN NEW.action IN ('故障停借','維修結案') THEN NEW.ref ELSE NULL END WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE INDEX audit_loan_reference ON audit(loan_id);
--> statement-breakpoint
CREATE INDEX audit_repair_reference ON audit(repair_id);
--> statement-breakpoint
CREATE TRIGGER user_account_immutable BEFORE UPDATE OF id,account ON users
 WHEN NEW.id<>OLD.id OR NEW.account<>OLD.account BEGIN SELECT RAISE(ABORT,'USER_IDENTITY_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER user_backfill_known_account AFTER INSERT ON users BEGIN
 UPDATE loans SET student_id=NEW.id WHERE student=NEW.account AND student_id IS NULL;
 UPDATE loans SET actor_id=NEW.id WHERE actor=NEW.account AND actor_id IS NULL;
 UPDATE rooms SET actor_id=NEW.id WHERE actor=NEW.account AND actor_id IS NULL;
 UPDATE room_reservations SET student_id=NEW.id WHERE student=NEW.account AND student_id IS NULL;
 UPDATE room_reservations SET actor_id=NEW.id WHERE actor=NEW.account AND actor_id IS NULL;
 UPDATE room_events SET actor_id=NEW.id WHERE actor=NEW.account AND actor_id IS NULL;
 UPDATE audit SET actor_id=NEW.id WHERE actor=NEW.account AND actor_id IS NULL;
 UPDATE sessions SET user_id=NEW.id WHERE actor=NEW.account AND user_id IS NULL;
END;
