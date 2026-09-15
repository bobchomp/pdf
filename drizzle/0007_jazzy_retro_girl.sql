CREATE TABLE `flipbook_link_clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`view_id` text NOT NULL,
	`flipbook_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`url` text NOT NULL,
	`clicked_at` integer NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `flipbook_views`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flipbook_id`) REFERENCES `flipbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flipbook_page_events` (
	`id` text PRIMARY KEY NOT NULL,
	`view_id` text NOT NULL,
	`flipbook_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `flipbook_views`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flipbook_id`) REFERENCES `flipbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `flipbook_views` ADD `device_type` text;--> statement-breakpoint
ALTER TABLE `flipbook_views` ADD `browser` text;--> statement-breakpoint
ALTER TABLE `flipbook_views` ADD `country` text;--> statement-breakpoint
ALTER TABLE `flipbook_views` ADD `region` text;