CREATE TABLE `tutor_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_hash` text NOT NULL,
	`page` integer NOT NULL,
	`question` text NOT NULL,
	`region_title` text NOT NULL,
	`confidence_permille` integer NOT NULL,
	`needs_confirmation` integer NOT NULL,
	`answer_title` text NOT NULL,
	`answer` text NOT NULL,
	`evidence` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tutor_requests_actor_created_idx` ON `tutor_requests` (`actor_hash`,`created_at`);