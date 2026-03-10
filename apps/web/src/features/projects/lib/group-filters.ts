export const ALL_GROUP_FILTER = "__all__" as const
export const UNGROUPED_GROUP_FILTER = "__ungrouped__" as const

export type GroupFilter =
  | typeof ALL_GROUP_FILTER
  | typeof UNGROUPED_GROUP_FILTER
  | string
