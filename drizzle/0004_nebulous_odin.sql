CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`allow_download` integer DEFAULT true NOT NULL,
	`allow_print` integer DEFAULT true NOT NULL,
	`theme_color` text DEFAULT '#0f2044' NOT NULL,
	`show_toolbar` integer DEFAULT true NOT NULL,
	`background_image_r2_key` text,
	`background_fit` text DEFAULT 'contain' NOT NULL,
	`background_position` text DEFAULT 'center' NOT NULL,
	`logo_r2_key` text,
	`logo_link_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `flipbooks` ADD `preset_id` text;