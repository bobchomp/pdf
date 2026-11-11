CREATE TABLE `api_events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`view_id` text NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`type` text NOT NULL,
	`page_number` integer,
	`url` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `api_views`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `api_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_events_id_unique` ON `api_events` (`id`);--> statement-breakpoint
CREATE INDEX `api_events_project_seq_idx` ON `api_events` (`project_id`,`seq`);--> statement-breakpoint
CREATE INDEX `api_events_occurred_idx` ON `api_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `api_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`url` text NOT NULL,
	`event_count` integer NOT NULL,
	`first_seq` integer,
	`last_seq` integer,
	`is_test` integer DEFAULT false NOT NULL,
	`success` integer NOT NULL,
	`status_code` integer,
	`error` text,
	`duration_ms` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `api_webhook_deliveries_project_idx` ON `api_webhook_deliveries` (`project_id`,`attempted_at`);--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_url` text;--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_secret` text;--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_cursor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_next_attempt_at` integer;--> statement-breakpoint
ALTER TABLE `api_projects` ADD `webhook_locked_until` integer;