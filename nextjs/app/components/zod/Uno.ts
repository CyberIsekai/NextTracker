import { z } from 'zod'
import { C } from '@/app/components/Consts'

export const PlayerUnoSchema = z.string()
    .regex(/^\d+$/, { message: `${C.UNO} must be a numeric string` })
    .describe(`${C.PLAYER} identifier consisting of only numeric characters`)
    .readonly()
export type PlayerUno = z.infer<typeof PlayerUnoSchema>

export const GroupUnoSchema = z.string()
    .min(+process.env.GROUP_NAME_LENGTH_REQUIRED!)
    .max(+process.env.GROUP_NAME_LENGTH_LIMIT!)
    .regex(/^[^\d\s]+$/, { message: 'No numbers or spaces allowed' })

export type GroupUno = z.infer<typeof GroupUnoSchema>

export const UnoSchema = PlayerUnoSchema.or(GroupUnoSchema)
export type Uno = PlayerUno | GroupUno
