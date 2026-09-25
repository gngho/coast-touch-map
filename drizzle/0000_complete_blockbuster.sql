CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`trial_id` text,
	`type` text NOT NULL,
	`actor` text NOT NULL,
	`server_time` integer NOT NULL,
	`client_time` text,
	`page_id` text,
	`generation` integer,
	`payload` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_session_time` ON `events` (`session_id`,`server_time`);--> statement-breakpoint
CREATE INDEX `events_trial` ON `events` (`trial_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`admin_hash` text NOT NULL,
	`code_hash` text,
	`code_expires` integer,
	`device_hash` text,
	`page_id` text,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation` text,
	`device_seen` integer DEFAULT 0 NOT NULL,
	`admin_seen` integer DEFAULT 0 NOT NULL,
	`applied_generation` integer DEFAULT -1 NOT NULL,
	`applied_trial` text,
	`pending_events` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_owner` ON `sessions` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_code` ON `sessions` (`code_hash`);--> statement-breakpoint
CREATE TABLE `trials` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`number` integer NOT NULL,
	`participant` text NOT NULL,
	`relationship` text NOT NULL,
	`intervention` text NOT NULL,
	`scenario` text NOT NULL,
	`app_version` text NOT NULL,
	`status` text NOT NULL,
	`prepared_at` integer NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trials_session_number` ON `trials` (`session_id`,`number`);