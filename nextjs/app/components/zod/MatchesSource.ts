import { z } from 'zod'
import { C } from '@/app/components/Consts'

export const MatchesSourceFullmatchesSchema = z.enum([C.BASIC, C.MAIN])
export type MatchesSourceFullmatches = z.infer<typeof MatchesSourceFullmatchesSchema>

export const MatchesSourceSchema = z.enum([
    C.MATCHES,
    ...MatchesSourceFullmatchesSchema.options,
])
export type MatchesSource = z.infer<typeof MatchesSourceSchema>
