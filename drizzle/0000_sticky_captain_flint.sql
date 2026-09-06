CREATE TABLE `flipbook_views` (
	`id` text PRIMARY KEY NOT NULL,
	`flipbook_id` text NOT NULL,
	`viewed_at` integer NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	FOREIGN KEY (`flipbook_id`) REFERENCES `flipbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flipbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`original_filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_size_bytes` integer DEFAULT 0 NOT NULL,
	`page_count` integer DEFAULT 0 NOT NULL,
	`cover_image_r2_key` text,
	`is_private` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`allow_download` integer DEFAULT true NOT NULL,
	`allow_print` integer DEFAULT true NOT NULL,
	`theme_color` text DEFAULT '#1e293b' NOT NULL,
	`show_toolbar` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flipbooks_slug_unique` ON `flipbooks` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);