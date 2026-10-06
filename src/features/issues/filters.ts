/** The kinds of filter a list of issues can have, and how many are set. */
import type { Filters } from '@/model/schema'

export type FilterKey = 'statuses' | 'assignees' | 'priorities' | 'labels' | 'projects' | 'teams'

const KEYS: FilterKey[] = ['statuses', 'assignees', 'priorities', 'labels', 'projects', 'teams']

/** how many filters are set (a filter with no values doesn't count) */
export const activeFilters = (f: Filters) => KEYS.filter((k) => (f[k]?.length ?? 0) > 0).length
