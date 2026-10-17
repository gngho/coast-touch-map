CREATE INDEX `events_schedule_created` ON `events` (`session_id`,`server_time`,`id`) WHERE "events"."type"='schedule_created';--> statement-breakpoint
CREATE INDEX `events_prepare_plan_person` ON `events` (session_id,json_extract(payload,'$.schedule.planId'),json_extract(payload,'$.participant')) WHERE type='prepare';--> statement-breakpoint
CREATE INDEX `events_survey_plan_person` ON `events` (session_id,json_extract(payload,'$.planId'),json_extract(payload,'$.participant')) WHERE type='survey_completed';
