import { z } from 'zod'
import { C } from '@/app/components/Consts'

export const MatchesSourceMatchesSchema = z.enum([C.MATCHES])
export type MatchesSourceMatches = z.infer<typeof MatchesSourceMatchesSchema>

export const MatchesSourceFullmatchesSchema = z.enum([C.ALL, C.BASIC, C.MAIN])
export type MatchesSourceFullmatches = z.infer<typeof MatchesSourceFullmatchesSchema>

export const MatchesSourceSchema = z.enum([
    ...MatchesSourceMatchesSchema.options,
    ...MatchesSourceFullmatchesSchema.options,
])
export type MatchesSource = z.infer<typeof MatchesSourceSchema>
