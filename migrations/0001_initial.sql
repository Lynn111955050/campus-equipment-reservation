CREATE TABLE assets(tag TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('相機','收音','腳架')),status TEXT NOT NULL DEFAULT '可借' CHECK(status IN ('可借','維修中')));
CREATE TABLE loans(id TEXT PRIMARY KEY,tag TEXT NOT NULL REFERENCES assets(tag),student TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL CHECK(end>start),status TEXT NOT NULL DEFAULT '已預約',picked INTEGER,returned INTEGER,reason TEXT,actor TEXT NOT NULL);
CREATE UNIQUE INDEX one_out ON loans(tag) WHERE status='已取件';
CREATE INDEX by_slot ON loans(tag,start,end);
CREATE TABLE repairs(id TEXT PRIMARY KEY,tag TEXT NOT NULL REFERENCES assets(tag),loan TEXT NOT NULL UNIQUE REFERENCES loans(id),note TEXT NOT NULL,opened INTEGER NOT NULL,closed INTEGER,resolution TEXT);
CREATE UNIQUE INDEX one_repair ON repairs(tag) WHERE closed IS NULL;
CREATE TABLE audit(id INTEGER PRIMARY KEY,tag TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,ref TEXT,at INTEGER NOT NULL DEFAULT(unixepoch()*1000));
CREATE TABLE requests(actor TEXT NOT NULL,key TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(actor,key));
CREATE TABLE sessions(token TEXT PRIMARY KEY,actor TEXT NOT NULL,role TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TRIGGER validate_book BEFORE INSERT ON loans BEGIN
 SELECT CASE WHEN (SELECT status FROM assets WHERE tag=NEW.tag) IS NOT '可借' THEN RAISE(ABORT,'ASSET_UNAVAILABLE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM loans WHERE tag=NEW.tag AND status<>'已取消' AND start<NEW.end AND end>NEW.start) THEN RAISE(ABORT,'SLOT_CONFLICT') END;
END;
CREATE TRIGGER booked AFTER INSERT ON loans BEGIN
 INSERT INTO audit(tag,actor,action,ref) VALUES(NEW.tag,NEW.actor,'建立預約',NEW.id);
END;
CREATE TRIGGER loan_event AFTER UPDATE OF status ON loans WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO audit(tag,actor,action,ref) VALUES(NEW.tag,NEW.actor,NEW.status,NEW.id);
END;
CREATE TRIGGER faulty AFTER INSERT ON repairs BEGIN
 UPDATE assets SET status='維修中' WHERE tag=NEW.tag;
 UPDATE loans SET status='已取消',reason='器材故障停借',actor=(SELECT actor FROM loans WHERE id=NEW.loan) WHERE tag=NEW.tag AND status='已預約' AND start+900000>NEW.opened;
 INSERT INTO audit(tag,actor,action,ref) SELECT NEW.tag,actor,'故障停借',NEW.id FROM loans WHERE id=NEW.loan;
END;
