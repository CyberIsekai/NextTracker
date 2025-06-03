import { z } from 'zod'
import {
    GameModeOnlySchema,
    ModeOnlySchema,
} from '@/app/components/zod/GameMode'
import { LabelDataSchema } from '@/app/components/zod/Label'
import {
    GameBasicColumnSchema,
    MatchIDSchema,
    MatchLoadoutDataStatsSchema,
    MatchResultSchema,
} from '@/app/components/zod/Match'
import { MatchesSourceSchema } from '@/app/components/zod/MatchesSource'
import { UnoSchema } from '@/app/components/zod/Uno'

export const MatchesGameBasicStatsSchema = z.record(
    GameBasicColumnSchema, z.number().nonnegative()
).refine((game_basic_columns): game_basic_columns is Required<typeof game_basic_columns> =>
    GameBasicColumnSchema.options.every(
        basic_column => game_basic_columns[basic_column] != null
    ),
)
export type MatchesGameBasicStats = z.infer<typeof MatchesGameBasicStatsSchema>

export const MatchesDataSchema = z.intersection(
    MatchesGameBasicStatsSchema,
    z.object({
        id: z.number(),
        game_mode: GameModeOnlySchema,
        matchID: MatchIDSchema,
        map: LabelDataSchema,
        mode: LabelDataSchema,
        result: MatchResultSchema,
        player: z.string(),
        loadout: z.record(z.string(), z.number().nonnegative()),
        weaponStats: z.array(MatchLoadoutDataStatsSchema).optional(),
        source: MatchesSourceSchema,
        time: z.string().datetime(),
    })
)
export type MatchesData = z.infer<typeof MatchesDataSchema>

export const DateDataSchema = z.object({
    win: z.number().nonnegative(),
    loss: z.number().nonnegative(),
    draw: z.number().nonnegative(),
    matches: z.array(MatchesDataSchema),
    stats: MatchesGameBasicStatsSchema,
    loadout: z.record(z.string(), z.number().nonnegative()),
    is_same_map: z.boolean(),
})
export type DateData = z.infer<typeof DateDataSchema>

export const MatchesResponseSchema = z.object({
    matches: z.array(MatchesDataSchema),
    found: z.number(),
})
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>

const WeaponSchema = z.object({
    name: z.string(),
    label: z.string().nullable(),
    imageLoot: z.string().nullable(),
    imageIcon: z.string().nullable(),
    variant: z.string(),
    attachments: z.array(z.object({
        name: z.string(),
        label: z.string().nullable(),
        image: z.string().nullable(),
        category: z.string().nullable(),
    }))
})
const PerkSchema = z.object({
    name: z.string(),
    label: z.string().nullable(),
    image: z.string().nullable(),
    imageMainUi: z.string().nullable(),
    imageProgression: z.string().nullable(),
})
const KillstreakSchema = z.object({
    name: z.string(),
    label: z.string().nullable(),
})
const EquipmentSchema = z.object({
    name: z.string(),
    label: z.string().nullable(),
    image: z.string().nullable(),
    imageLarge: z.string().nullable(),
    progressionImage: z.string().nullable(),
})

export const LoadoutRawSchema = z.object({
    primaryWeapon: WeaponSchema,
    secondaryWeapon: WeaponSchema,
    perks: z.array(PerkSchema),
    extraPerks: z.array(PerkSchema),
    killstreaks: z.array(KillstreakSchema),
    tactical: EquipmentSchema,
    lethal: EquipmentSchema,
})
export type LoadoutRaw = z.infer<typeof LoadoutRawSchema>

export const WeaponStatsRawSchema = z.record(z.string(), z.object({
    hits: z.number(),
    kills: z.number(),
    headshots: z.number(),
    loadoutIndex: z.number(),
    shots: z.number(),
    startingWeaponXp: z.number(),
    deaths: z.number(),
    xpEarned: z.number(),
}))
export type WeaponStatsRaw = z.infer<typeof WeaponStatsRawSchema>

export const MatchesRawSchema = z.object({
    utcStartSeconds: z.number(),
    utcEndSeconds: z.number(),
    map: z.string(),
    mode: z.string(),
    matchID: MatchIDSchema,
    duration: z.number(),
    playlistName: z.string().nullable(),
    version: z.number(),
    gameType: ModeOnlySchema,
    playerCount: z.number(),
    playerStats: z.record(z.string(), z.number()),
    weaponStats: WeaponStatsRawSchema.optional(),
    player: z.object({
        team: z.string(),
        rank: z.number(),
        username: z.string(),
        uno: UnoSchema,
        clantag: z.string(),
        brMissionStats: z.object({
            missionsComplete: z.number(),
            totalMissionXpEarned: z.number(),
            totalMissionWeaponXpEarned: z.number(),
            missionStatsByType: z.object({})
        }),
        loadout: z.array(LoadoutRawSchema),
    }),
    teamCount: z.number(),
    rankedTeams: z.null(),
    draw: z.boolean(),
    privateMatch: z.boolean(),
})
export type MatchesRaw = z.infer<typeof MatchesRawSchema>
