DELETE FROM `contract_versions`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `contract_versions`
  GROUP BY `contract_id`, `version`
);--> statement-breakpoint
DELETE FROM `contracts`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `contracts`
  GROUP BY `project_id`, `method`, `path`
);--> statement-breakpoint
DELETE FROM `env_variables`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `env_variables`
  GROUP BY `environment_id`, `key`
);--> statement-breakpoint
DELETE FROM `environments`
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM `environments`
  GROUP BY `project_id`, `name`
);--> statement-breakpoint
CREATE UNIQUE INDEX `contract_versions_contract_version_unique` ON `contract_versions` (`contract_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `contracts_project_method_path_unique` ON `contracts` (`project_id`,`method`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `env_variables_environment_key_unique` ON `env_variables` (`environment_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `environments_project_name_unique` ON `environments` (`project_id`,`name`);
