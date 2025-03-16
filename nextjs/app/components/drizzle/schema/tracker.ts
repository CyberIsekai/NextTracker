import {
    pgTable,
    serial,
    varchar,
    timestamp,
    jsonb,
    json,
} from 'drizzle-orm/pg-core'
import * as tracker_abstract from './tracker_abstract'
import * as logs_abstract from './logs_abstract'
import { index_builder } from './utils'
import {
    C,
    NAME_LIMIT,
    NAME_LIMIT_2
} from '@/app/components/Consts'
import { GamesStatus } from '@/app/components/zod/GameStatus'
import { GamesStats } from '@/app/components/zod/GamesStats'
import { Chart } from '@/app/components/zod/Chart'
import { MostPlayWith } from '@/app/components/zod/MostPlayWith'
import { Loadout } from '@/app/components/zod/Loadout'
import { PlayerUno, GroupUno } from '@/app/components/zod/Uno'
import { Task } from '@/app/components/zod/Task'
import { LogsSearchData } from '@/app/components/zod/Logs'
import {
    Player,
    PlayerActi,
    PlayerBattle,
} from '@/app/components/zod/Player'

export const cod_players = pgTable('cod_players', {
    id: serial(C.ID).primaryKey().unique().notNull(),
    uno: varchar(C.UNO, { length: NAME_LIMIT_2 }).$type<PlayerUno>().unique().notNull(),
    acti: varchar(C.ACTI, { length: NAME_LIMIT_2 }).$type<PlayerActi>(),
    battle: varchar(C.BATTLE, { length: NAME_LIMIT_2 }).$type<PlayerBattle>(),
    username: json(C.USERNAME).$type<Player['username']>().default([]).notNull(),
    clantag: json(C.CLANTAG).$type<Player['clantag']>().default([]).notNull(),
    group: varchar(C.GROUP, { length: NAME_LIMIT_2 }).$type<GroupUno | null>().default(null),
    games: jsonb(C.GAMES).$type<GamesStatus>().notNull(),
    time: timestamp(C.TIME).defaultNow().notNull(),

    games_stats: jsonb(C.GAMES_STATS).$type<GamesStats>().default({}).notNull(),
    chart: jsonb(C.CHART).$type<Chart | null>().default(null),
    most_play_with: jsonb(C.MOST_PLAY_WITH).$type<MostPlayWith | null>().default(null),
    loadout: jsonb(C.LOADOUT).$type<Loadout | null>().default(null),
    data: jsonb(C.DATA).$type<Player['data']>().default({}).notNull(),
}, table => index_builder([table.id], [table.uno])
)

export const cod_label_map = pgTable('cod_label_map', tracker_abstract.cod_label())
export const cod_label_weapons = pgTable('cod_label_weapons', tracker_abstract.cod_label())
export const cod_label_attachments = pgTable('cod_label_attachments', tracker_abstract.cod_label())
export const cod_label_perks = pgTable('cod_label_perks', tracker_abstract.cod_label())
export const cod_label_killstreaks = pgTable('cod_label_killstreaks', tracker_abstract.cod_label())
export const cod_label_tactical = pgTable('cod_label_tactical', tracker_abstract.cod_label())
export const cod_label_lethal = pgTable('cod_label_lethal', tracker_abstract.cod_label())
export const cod_label_games_stats = pgTable('cod_label_games_stats', tracker_abstract.cod_label())

export const cod_logs = pgTable(
    'cod_logs',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const cod_logs_player = pgTable(
    'cod_logs_player',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const cod_logs_error = pgTable(
    'cod_logs_error',
    logs_abstract.logs(),
    table => index_builder([table.id, table.time])
)

export const cod_logs_search = pgTable(
    'cod_logs_search',
    {
        id: serial(C.ID).primaryKey().unique().notNull(),
        target: varchar(C.TARGET, { length: NAME_LIMIT }).unique().notNull(),
        uno: varchar(C.UNO, { length: NAME_LIMIT }).$type<PlayerUno>(),
        data: jsonb(C.DATA).$type<LogsSearchData[]>().default([]).notNull(),
        time: timestamp(C.TIME).defaultNow().notNull(),
    },
    table => index_builder([table.id, table.uno, table.time], [table.target])
)

export const cod_logs_task_queues = pgTable(
    'cod_logs_task_queues',
    {
        id: serial(C.ID).primaryKey().unique().notNull(),
        name: varchar(C.NAME, { length: NAME_LIMIT_2 }).notNull(),
        status: varchar(C.STATUS, { length: NAME_LIMIT }).$type<Task['status']>().notNull(),
        data: jsonb(C.DATA).$type<Task['data']>().default({}).notNull(),
        time: timestamp(C.TIME).defaultNow().notNull(),
        time_started: timestamp('time_started').$type<Date | null>(),
        time_end: timestamp('time_end').$type<Date | null>(),
    },
    table => index_builder([table.id, table.time])
)

export const cod_matches_mw_mp = pgTable(
    'cod_matches_mw_mp',
    tracker_abstract.matches_mw_mp(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_matches_mw_wz = pgTable(
    'cod_matches_mw_wz',
    tracker_abstract.matches_mw_wz(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_matches_cw_mp = pgTable(
    'cod_matches_cw_mp',
    tracker_abstract.matches_cw_mp(),
    table => index_builder(
        tracker_abstract.matches_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_matches_vg_mp = pgTable(
    'cod_matches_vg_mp',
    tracker_abstract.matches_vg_mp(),
    table => index_builder(
        tracker_abstract.matches_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_mw_mp = pgTable(
    'cod_fullmatches_mw_mp',
    tracker_abstract.fullmatches_mw_mp(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_mw_wz_2020 = pgTable(
    'cod_fullmatches_mw_wz_2020',
    tracker_abstract.fullmatches_mw_wz(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_mw_wz_2021 = pgTable(
    'cod_fullmatches_mw_wz_2021',
    tracker_abstract.fullmatches_mw_wz(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_mw_wz_2022 = pgTable(
    'cod_fullmatches_mw_wz_2022',
    tracker_abstract.fullmatches_mw_wz(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_mw_wz_2023 = pgTable(
    'cod_fullmatches_mw_wz_2023',
    tracker_abstract.fullmatches_mw_wz(),
    table => index_builder(
        tracker_abstract.matches_basic_mw_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_basic_mw_mp = pgTable(
    'cod_fullmatches_basic_mw_mp',
    tracker_abstract.fullmatches_mw_mp_basic(),
    table => index_builder(
        tracker_abstract.all_games_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_basic_mw_wz_2020 = pgTable(
    'cod_fullmatches_basic_mw_wz_2020',
    tracker_abstract.fullmatches_mw_wz_basic(),
    table => index_builder(
        tracker_abstract.all_games_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_basic_mw_wz_2021 = pgTable(
    'cod_fullmatches_basic_mw_wz_2021',
    tracker_abstract.fullmatches_mw_wz_basic(),
    table => index_builder(
        tracker_abstract.all_games_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_basic_mw_wz_2022 = pgTable(
    'cod_fullmatches_basic_mw_wz_2022',
    tracker_abstract.fullmatches_mw_wz_basic(),
    table => index_builder(
        tracker_abstract.all_games_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)

export const cod_fullmatches_basic_mw_wz_2023 = pgTable(
    'cod_fullmatches_basic_mw_wz_2023',
    tracker_abstract.fullmatches_mw_wz_basic(),
    table => index_builder(
        tracker_abstract.all_games_basic_indexes.map(
            column => table[column as keyof typeof table]
        ),
        []
    )
)
