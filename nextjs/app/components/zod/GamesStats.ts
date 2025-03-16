import { z } from 'zod'
import { C } from '@/app/components/Consts'
import { GameSchema } from '@/app/components/zod/GameMode'

export const GameStatsDataWeaponKeySchema = z.enum([
    'weapon_assault_rifle',
    'weapon_smg',
    'weapon_shotgun',
    'weapon_sniper',
    'weapon_lmg',
    'weapon_pistol',
    'weapon_marksman',
    'weapon_melee',
    'weapon_launcher',
    'weapon_other',
])
export type GameStatsDataWeaponKey = z.infer<typeof GameStatsDataWeaponKeySchema>
export const GameStatsDataKeySchema = z.enum([
    'attachment',
    'lethals',
    'tacticals',
    'supers',
    ...GameStatsDataWeaponKeySchema.options,
])
export type GameStatsDataKey = z.infer<typeof GameStatsDataKeySchema>

export const GameStatsDataKeySimpleSchema = z.enum(['all', 'all_additional'])
export const GameStatsDataKeyAllSchema = z.enum([
    ...GameStatsDataKeySimpleSchema.options,
    'scorestreak',
    ...GameStatsDataKeySchema.options,
])
export type GameStatsDataKeyAll = z.infer<typeof GameStatsDataKeyAllSchema>

export const StatNameBasicSchema = z.enum([
    C.KILLS,
    C.DEATHS,
    C.KDRATIO,
    'score',
    'scorePerMinute',
])
export type StatNameBasic = z.infer<typeof StatNameBasicSchema>

export const StatNameMapSchema = z.enum([
    C.TIME_PLAYED,
    'win',
    'loss',
    'draw',
    'wlRatio',
    'stat1',
    'stat2',
    'stat1Stat2Ratio',
    'avgStat1',
    'avgStat2',
])
export type StatNameMap = z.infer<typeof StatNameMapSchema>

export const StatNameAttachmentSchema = z.enum([
    C.KILLS,
    C.DEATHS,
    C.HEADSHOTS,
    'hits',
    'shots',
])
export type StatNameAttachment = z.infer<typeof StatNameAttachmentSchema>

export const StatNameMPSchema = z.enum([
    ...StatNameBasicSchema.options,
    C.TIME,
    C.TIME_PLAYED,
    'setBacks',
    'stabs',
    'captures',
    'defends',
    'denies',
    'confirms',
    'plants',
    'defuses',
])
export type StatNameMP = z.infer<typeof StatNameMPSchema>

export const StatNameWZSchema = z.enum([
    C.TIME_PLAYED,
    'wins',
    'downs',
    'topTwentyFive',
    'objTime',
    'topTen',
    'contracts',
    'revives',
    'topFive',
    'gamesPlayed',
    'tokens',
    'cash',
])
export type StatNameWZ = z.infer<typeof StatNameWZSchema>

export const StatNameWeaponBasicSchema = z.enum([
    C.KILLS,
    C.DEATHS,
    C.KDRATIO,
    C.ACCURACY,
    C.HEADSHOTS,
    'hits',
    'shots',
])
export type StatNameWeaponBasic = z.infer<typeof StatNameWeaponBasicSchema>

export const StatNameWeaponSchema = z.enum([
    ...StatNameWeaponBasicSchema.options,
    C.USES,
    'extraStat1',
    'awardedCount',
    'misc1',
    'misc2',
])
export type StatNameWeapon = z.infer<typeof StatNameWeaponSchema>

export const StatNameCWMPSchema = z.enum([
    ...StatNameMPSchema.options,
    'timePlayedTotal',
    'wins',
    'objectiveScore',
    'killStreak',
    'ekiadRatio',
    'damagePerGame',
    'winStreak',
    'offends',
    'curWinStreak',
    'losses',
    'ekia',
    'totalDamage',
    'crush',
    'wlRatio',
    'ties',
    'assists',
])
export type StatNameCWMP = z.infer<typeof StatNameCWMPSchema>

export const StatNameCWSchema = z.enum([
    'used',
    'assists',
    'damageDone',
    'timeUsed',
    'ekia',
    'deathsDuringUse',
    'gamesUsed',
    'destroyed',
    'masterCraftCamoProgression',
    'killstreak30',
    'combatRecordStat',
    'backstabberKill',
    'challenges',
    'challenge1',
    'challenge2',
    'challenge3',
    'challenge4',
    'challenge5',
    'challenge6',
    'challenge7',
])
export type StatNameCW = z.infer<typeof StatNameCWSchema>

export const StatNameScorestreakCWSchema = z.enum([
    C.KILLS,
    C.DEATHS,
    C.USES,
    'assists',
    'destructions',
    'enemyCarePackageCaptures',
    'multikillForMedalSpotlight',
    'armoredKills',
    'bestAssists',
    'bestKillsPerGame',
    'bestKills',
    'bestDestructions',
    'bestEnemyCarePackageCaptures',
    'bestKillsPerUse',
])
export type StatNameScorestreakCW = z.infer<typeof StatNameScorestreakCWSchema>

export const StatNameAllSchema = z.enum([
    ...StatNameWZSchema.options,
    ...StatNameCWSchema.options,
    ...StatNameCWMPSchema.options,
    ...StatNameWeaponSchema.options,
    ...StatNameScorestreakCWSchema.options,
])
export type StatNameAll = z.infer<typeof StatNameAllSchema>

export const GameStatsAllBasicKeysSchema = z.enum([
    C.KILLS,
    C.DEATHS,
    C.KDRATIO,
    C.ACCURACY,
    C.HEADSHOTS,
    'longestStreak',
    'assists',
    'score',
    'scorePerMinute',
    'wins',
    'losses',
    'wlRatio',
    'totalShots',
    'hits',
    'misses',
    'scorePerGame',
    'suicides',
    // 'currentWinStreak',
    'totalGamesPlayed',
    'timePlayedTotal',
])
export type GameStatsAllBasicKeys = z.infer<typeof GameStatsAllBasicKeysSchema>

const GameStatsAllSchema = z.object(
    Object.fromEntries(
        GameStatsAllBasicKeysSchema.options.map(key => [key, z.number()])
    ) as Record<GameStatsAllBasicKeys, z.ZodNumber>,
).catchall(z.number().optional())
export type GameStatsAll = z.infer<typeof GameStatsAllSchema>

export const GameStatsDataStatsSchema = z.record(StatNameAllSchema, z.number().optional())
export type GameStatsDataStats = z.infer<typeof GameStatsDataStatsSchema>

const GameStatsDataSchema = z.object({
    all: GameStatsDataStatsSchema
}).catchall(GameStatsDataStatsSchema.optional())
export type GameStatsData = z.infer<typeof GameStatsDataSchema>

export const GameStatsSchema = z.object({
    all: GameStatsAllSchema,
    all_additional: z.record(z.string(), z.number().optional()).optional(),
    scorestreak: GameStatsDataSchema,
}).catchall(GameStatsDataSchema.optional())

export type GameStats = z.infer<typeof GameStatsSchema>

export const GamesStatsSchema = z.record(GameSchema, GameStatsSchema)
export type GamesStats = z.infer<typeof GamesStatsSchema>

export const GameStatsDataLifetimeBasicSchema = z.object({
    all: z.object({ properties: GameStatsAllSchema }),
    mode: z.record(z.string(), z.object({
        properties: z.intersection(
            z.record(StatNameBasicSchema, z.number()),
            z.record(StatNameMPSchema, z.number().optional()),
        ),
    })),
    map: z.record(
        z.string(),
        z.record(
            z.string(),
            z.object({ properties: z.record(StatNameMapSchema, z.number()) }),
        )
    ),
})
export type GameStatsDataLifetimeBasic = z.infer<typeof GameStatsDataLifetimeBasicSchema>

export const GameStatsDataWeaponValueSchema = z.record(z.string(), z.object({
    properties: z.record(StatNameWeaponSchema, z.number()),
}))
export type GameStatsDataWeaponValue = z.infer<typeof GameStatsDataWeaponValueSchema>

export const GameStatsDataLifetimeSchema = z.intersection(
    GameStatsDataLifetimeBasicSchema,
    z.object({
        accoladeData: z.object({
            properties: z.record(z.string(), z.number()),
        }),

        attachmentData: z.record(z.string(), z.object({
            properties: z.record(StatNameAttachmentSchema, z.number()),
        })).optional(),

        scorestreakData: z.object({
            lethalScorestreakData: z.record(z.string(), z.object({
                properties: z.record(
                    z.enum([C.USES, 'extraStat1', 'awardedCount']),
                    z.number(),
                ),
            })),
            supportScorestreakData: z.record(z.string(), z.object({
                properties: z.record(
                    z.enum([C.USES, 'extraStat1', 'awardedCount']),
                    z.number(),
                ),
            })),
        }),

        itemData: z.intersection(
            z.object({
                lethals: z.record(z.string(), z.object({
                    properties: z.object({
                        uses: z.number(),
                        kills: z.number(),
                    }),
                })),
                tacticals: z.record(z.string(), z.object({
                    properties: z.object({
                        uses: z.number(),
                        extraStat1: z.number(),
                    }),
                })),
                supers: z.record(z.string(), z.object({
                    properties: z.object({
                        uses: z.number(),
                        kills: z.number(),
                        misc1: z.number(),
                        misc2: z.number(),
                    }),
                })),
            }),
            z.object(
                Object.fromEntries(
                    GameStatsDataWeaponKeySchema.options.map(key => [key, GameStatsDataWeaponValueSchema])
                ) as Record<GameStatsAllBasicKeys, typeof GameStatsDataWeaponValueSchema>,
            ),
        )
    }),
)
export type GameStatsDataLifetime = z.infer<typeof GameStatsDataLifetimeSchema>

const GameStatsDataLifetimeCWScorestreakSchema = z.record(
    z.string(),
    z.object({ properties: z.record(StatNameScorestreakCWSchema, z.number()) }),
)

const StatNameAttachmentCWSchema = z.enum([
    ...StatNameAttachmentSchema.options,
    ...StatNameCWSchema.options,
] as const)
export type StatNameAttachmentCW = z.infer<typeof StatNameAttachmentCWSchema>

const StatNameWeaponBasicCWSchema = z.enum([
    ...StatNameWeaponBasicSchema.options,
    ...StatNameCWSchema.options,
] as const)
export type StatNameWeaponBasicCW = z.infer<typeof StatNameWeaponBasicCWSchema>

const GameStatsDataLifetimeCWitemDataValueSchema = z.record(
    z.string(),
    z.object({
        properties: z.record(StatNameWeaponBasicCWSchema, z.number())
    }),
)


export const GameStatsDataLifetimeCWSchema = z.intersection(
    GameStatsDataLifetimeBasicSchema,
    z.object({
        scorestreakData: z.object({
            scorestreakData: GameStatsDataLifetimeCWScorestreakSchema,
        }),
        itemData: z.intersection(
            z.object({
                scorestreak: GameStatsDataLifetimeCWScorestreakSchema,
            }),
            z.object(
                Object.fromEntries(
                    GameStatsDataWeaponKeySchema.options.map(key =>
                        [key, GameStatsDataLifetimeCWitemDataValueSchema]
                    )
                ) as Record<GameStatsDataWeaponKey, typeof GameStatsDataLifetimeCWitemDataValueSchema>,
            ),
        ),
        attachmentData: z.record(z.string(), z.object({
            properties: z.record(StatNameAttachmentCWSchema, z.number()),
        })),
    }),
)
export type GameStatsDataLifetimeCW = z.infer<typeof GameStatsDataLifetimeCWSchema>
