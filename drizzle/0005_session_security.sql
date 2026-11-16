CREATE TABLE login_attempts (
 scope TEXT NOT NULL PRIMARY KEY,
 failures INTEGER NOT NULL CHECK(failures >= 1),
 window_start INTEGER NOT NULL,
 locked_until INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX login_attempts_expiry ON login_attempts(window_start);
--> statement-breakpoint
CREATE INDEX room_expiry_lookup ON room_reservations(status,start);
