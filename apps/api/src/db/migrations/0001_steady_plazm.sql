CREATE TABLE `contract_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_groups_project_name_unique` ON `contract_groups` (`project_id`,`name`);--> statement-breakpoint
ALTER TABLE `contracts` ADD `group_id` text REFERENCES contract_groups(id);