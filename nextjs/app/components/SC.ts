import { C } from '@/app/components/Consts'
import { GameBasicColumnSchema } from '@/app/components/zod/Match'

export default class SC {
    /** Global store game columns for tracker */

    static new_columns = new Set<string>()
    static META = [
        C.DURATION,
        C.MATCHID,
        C.MAP,
        C.MODE,
        C.RESULT,
        C.WEAPON_STATS,
        'team1Score',
        'team2Score',
        'playerCount',
        'teamCount',
    ] as const
    static ROUND = [
        C.KDRATIO,
        'wlRatio',
        'scorePerGame',
        'scorePerMinute',
        'ekiadRatio',
        'averageSpeedDuringMatch',
        'percentTimeMoving',
    ] as const
    static PLAYER = [
        C.UNO,
        C.USERNAME,
        C.CLANTAG,
        C.TEAM,
        C.LOADOUT,
        'operator',
        'operatorSkinId',
        'operatorExecution',
    ] as const
    static BASIC = [
        ...GameBasicColumnSchema.options,
        C.ID,
        C.UNO,
        C.RESULT,
        C.MATCHID,
        C.TIME,
        C.MAP,
        C.MODE,
    ] as const
    static ALL_STATS = [
        ...SC.BASIC,
        C.USERNAME,
        C.CLANTAG,
        C.TEAM,
        C.LOADOUT,
        C.WEAPON_STATS,
        'team1Score',
        'team2Score',
    ] as const
    static MATCH_META = [C.TIME, C.MODE, C.MAP, C.DURATION] as const
    static MATCH = {
        [C.MW_MP]: {
            [C.BASIC]: [
                C.ID,
                C.UNO,
                C.RESULT,
                C.USERNAME,
                C.TEAM,
                C.CLANTAG,
                ...GameBasicColumnSchema.options,
            ],
            meta: [...SC.MATCH_META, 'team1Score', 'team2Score'],
        },
        [C.MW_WZ]: {
            [C.BASIC]: [
                C.ID,
                C.UNO,
                C.RESULT,
                C.USERNAME,
                C.TEAM,
                C.CLANTAG,
                ...GameBasicColumnSchema.options,
            ],
            meta: SC.MATCH_META,
        },
    } as const
    static RENAME_TO_BASIC: Record<string, string> = {
        xpAtEnd: 'totalXp',
        damageDealt: 'damageDone',
        highestStreak: 'longestStreak',
        teamPlacement: C.RESULT,
    }
}
