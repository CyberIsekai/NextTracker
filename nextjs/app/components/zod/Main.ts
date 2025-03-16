import { z } from 'zod'
import { C } from '@/app/components/Consts'

export const TimeTypeSchema = z.enum([
    'second', 'minute', 'hour', 'day', 'week', 'month', 'year'
])
export type TimeType = z.infer<typeof TimeTypeSchema>

export const TargetTypeSchema = z.enum([C.PLAYER, C.GROUP])
export type TargetType = z.infer<typeof TargetTypeSchema>

export const RequestMethodSchema = z.nativeEnum({
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
} as const)
export type RequestMethod = z.infer<typeof RequestMethodSchema>

export const AlertColorSchema = z.enum([
    'bg-red-100 text-red-700',
    'bg-green-100 text-green-700',
    'bg-blue-100 text-blue-700',
    'bg-yellow-100 text-yellow-700',
])
export type AlertColor = z.infer<typeof AlertColorSchema>
export type Alert = `p-4 rounded-lg ${AlertColor}`

export const MessageStatusSchema = z.nativeEnum({
    ERROR: 0,
    SUCCESS: 1,
    MESSAGE: 2,
    ALERT: 3,
} as const)
export type MessageStatus = z.infer<typeof MessageStatusSchema>

export const PlatformOnlySchema = z.enum([C.UNO, C.ACTI, C.BATTLE])
export type PlatformOnly = z.infer<typeof PlatformOnlySchema>

export const PlatformSchema = z.enum([
    ...PlatformOnlySchema.options,
    C.SEARCH,
    'tracker_search'
])
export type Platform = z.infer<typeof PlatformSchema>

export const MessageSchema = z.object({
    message: z.string(),
})
export type Message = z.infer<typeof MessageSchema>

export const StatusSchema = z.object({
    status: z.boolean(),
})
export type Status = z.infer<typeof StatusSchema>

// export const PlayerMatchesHistoryParsSchema = z.object({
//     message: z.string(),
//     statuses: z.array(z.string()).nullable()
// })
// export type PlayerMatchesHistoryPars = z.infer<typeof PlayerMatchesHistoryParsSchema>

export const PlayerMatchesDeleteResponseSchema = z.object({
    mw_mp: z.number().nonnegative(),
    mw_wz: z.number().nonnegative(),
    cw_mp: z.number().nonnegative(),
    vg_mp: z.number().nonnegative(),
})
export type PlayerMatchesDeleteResponse = z.infer<typeof PlayerMatchesDeleteResponseSchema>
