import { z } from 'zod'

export const LoadoutStatsDataSchema = z.object({
    name: z.string(),
    count: z.number().nonnegative(),
})
export type LoadoutStatsData = z.infer<typeof LoadoutStatsDataSchema>

export const LoadoutSchema = z.object({
    all: z.array(LoadoutStatsDataSchema),
    mw_mp: z.array(LoadoutStatsDataSchema),
    mw_wz: z.array(LoadoutStatsDataSchema),
    time: z.string().datetime(),
})
export type Loadout = z.infer<typeof LoadoutSchema>
