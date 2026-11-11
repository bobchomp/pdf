CREATE TABLE `api_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`pdf_url` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_documents_project_external_unique` ON `api_documents` (`project_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `api_view_events` (
	`id` text PRIMARY KEY NOT NULL,
	`view_id` text NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`type` text NOT NULL,
	`page_number` integer NOT NULL,
	`url` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `api_views`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `api_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `api_view_events_project_occurred_idx` ON `api_view_events` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `api_viewer_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`settings` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `api_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `api_views` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`document_id` text NOT NULL,
	`token_id` text NOT NULL,
	`viewed_at` integer NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`device_type` text,
	`browser` text,
	`country` text,
	`region` text,
	FOREIGN KEY (`project_id`) REFERENCES `api_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `api_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `api_views_project_viewed_idx` ON `api_views` (`project_id`,`viewed_at`);--> statement-breakpoint
ALTER TABLE `api_projects` ADD `default_settings` text DEFAULT '{}' NOT NULL;