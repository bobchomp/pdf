-- Carry over anything recorded since phase 2: each view's start, then its page views and link clicks.
INSERT INTO `api_events` (`id`, `view_id`, `project_id`, `document_id`, `type`, `page_number`, `url`, `occurred_at`)
SELECT `id` || '_start', `id`, `project_id`, `document_id`, 'view_start', NULL, NULL, `viewed_at` * 1000 FROM `api_views`
UNION ALL
SELECT `id`, `view_id`, `project_id`, `document_id`, `type`, `page_number`, `url`, `occurred_at` * 1000 FROM `api_view_events`
ORDER BY 8;--> statement-breakpoint
DROP TABLE `api_view_events`;