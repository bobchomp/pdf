ALTER TABLE `users` ADD `developer_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `users` SET `developer_access` = 1 WHERE `role` = 'admin';
