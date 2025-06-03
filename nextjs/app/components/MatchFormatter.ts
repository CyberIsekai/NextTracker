import * as schema from '@/app/components/drizzle/schema'
import { db } from '@/app/components/drizzle/db'
import { eq } from 'drizzle-orm'
import SC from '@/app/components/SC'
import { C } from '@/app/components/Consts'
import { get_game_tables } from '@/app/components/Table'
import { LabelData, LabelType } from '@/app/components/zod/Label'
import { GameModeOnly } from '@/app/components/zod/GameMode'
import { get_last_id } from '@/app/components/UtilsBase'
import { is_none_value, round_number } from '@/app/components/Utils'
import { is_game_mode_mw } from '@/app/components/UtilsValidators'
import {
    MatchLoadout,
    MatchLoadoutSchema,
    MatchLoadoutWeapon,
    MatchLoadoutDataStats,
    MatchLoadoutDataWeaponStats,
    MatchLoadoutDataWeaponStatsSchema,
    MatchResultMpSchema,
} from '@/app/components/zod/Match'
import {
    MatchesRaw,
    LoadoutRaw,
    WeaponStatsRaw,
} from '@/app/components/zod/Matches'

export const LABEL_TABLES = {
    map: schema.cod_label_map,
    mode: schema.cod_label_mode,
    games_stats: schema.cod_label_games_stats,
    weapons: schema.cod_label_weapons,
    attachments: schema.cod_label_attachments,
    perks: schema.cod_label_perks,
    killstreaks: schema.cod_label_killstreaks,
    tactical: schema.cod_label_tactical,
    lethal: schema.cod_label_lethal,
} as const

class TrackerLabels {
    protected decoded: Record<LabelType, Record<string, LabelData>>
    protected encoded: Record<LabelType, Record<string, string>>

    constructor() {
        this.decoded = {} as Record<LabelType, Record<string, LabelData>>
        this.encoded = {} as Record<LabelType, Record<string, string>>
        Object.keys(LABEL_TABLES).forEach(key => {
            const label_type = key as LabelType
            this.decoded[label_type] = {}
            this.encoded[label_type] = {}
        })
    }

    static async create(): Promise<TrackerLabels> {
        const instance = new TrackerLabels()
        await instance.initialize()
        return instance
    }

    protected async initialize(): Promise<void> {
        for (const [key, table] of Object.entries(LABEL_TABLES)) {
            const label_type = key as LabelType
            const all_label_data = await db.select().from(table)

            for (const label_data of all_label_data) {
                const index = label_data.id.toString()
                this.decoded[label_type][index] = {
                    name: label_data.name,
                    label: label_data.label,
                }
                this.encoded[label_type][label_data.name] = index
            }
        }
    }

    private async create_index(
        label_data: LabelData,
        label_type: LabelType,
        game_mode: GameModeOnly,
    ): Promise<string> {
        const table = LABEL_TABLES[label_type]
        let data: typeof table.$inferSelect
        const [existing] = await db.select().from(table).where(eq(table.name, label_data.name)).limit(1)

        if (existing) {
            data = existing
        } else {
            const [new_label] = await db.insert(table).values({
                id: await get_last_id(table),
                name: label_data.name,
                label: label_data.label?.substring(0, 99) || null,
                game_mode,
            }).returning()
            data = new_label
        }

        const index = data.id.toString()

        this.decoded[label_type][index] = {
            name: data.name,
            label: data.label,
        }
        this.encoded[label_type][data.name] = index

        return index
    }

    async get_index(
        name: string | null,
        label: string | null,
        label_type: LabelType,
        game_mode: GameModeOnly,
    ): Promise<string | null> {
        if (!name || name === 'specialty_null' || is_none_value(name)) {
            return null
        }

        let index = this.encoded[label_type][name]

        if (!index) {
            index = await this.create_index({ name, label }, label_type, game_mode)
        }

        return index
    }

    async get_label_data_from_table(
        index: string, label_type: LabelType
    ): Promise<LabelData> {
        const table = LABEL_TABLES[label_type]
        const [existing] = await db.select().from(table).where(eq(table.id, +index)).limit(1)

        let label_data: LabelData

        if (existing) {
            label_data = { name: existing.name, label: existing.label }
        } else {
            label_data = { name: 'unknown', label: null }
        }

        this.decoded[label_type][index] = label_data
        this.encoded[label_type][label_data.name] = index

        return label_data
    }

    async get_label_data(
        index: string | null, label_type: LabelType
    ): Promise<LabelData> {
        if (!index) {
            return { name: 'unknown', label: null }
        }

        let label_data = this.decoded[label_type][index]

        if (label_data === undefined) {
            label_data = await this.get_label_data_from_table(index, label_type)
        }

        return structuredClone(label_data)
    }

    async get_mode(
        name: string | null,
        label_type: C.MAP | C.MODE,
        game_mode: GameModeOnly,
    ): Promise<LabelData> {
        const index = await this.get_index(name, null, label_type, game_mode)
        const label_data = await this.get_label_data(index, label_type)

        return label_data
    }
}

class MatchFormatter extends TrackerLabels {
    private GAME_COLUMNS: Record<GameModeOnly, string[]> = {
        [C.MW_MP]: [],
        [C.MW_WZ]: [],
        [C.CW_MP]: [],
        [C.VG_MP]: [],
    }

    readonly WEAPON_TYPES = Object.keys(MatchLoadoutSchema.shape) as (keyof MatchLoadout)[]
    readonly STAT_TYPES = Object.keys(MatchLoadoutDataWeaponStatsSchema.shape) as (keyof MatchLoadoutDataWeaponStats)[]

    private readonly SPLIT_ON_LOADOUTS = '\n'
    private readonly SPLIT_ON_WEAPONS = ','
    private readonly SPLIT_ON_INDEXES = ' '

    constructor() {
        super()
    }

    static async create(): Promise<MatchFormatter> {
        const instance = new MatchFormatter()
        await instance.initialize()
        return instance
    }

    protected async initialize(): Promise<void> {
        const tables = await get_game_tables(C.ALL, C.MATCHES)
        tables.forEach(t =>
            this.GAME_COLUMNS[t.game_mode] = Object.keys(t.table)
        )
    }

    async format_match(match_raw: MatchesRaw, game_mode: GameModeOnly) {
        const match: Record<string, unknown> = {}
        match.time = new Date(match_raw.utcStartSeconds * 1000)

        for (const [name, value] of Object.entries(match_raw.player)) {
            if (SC.PLAYER.includes(name as typeof SC.PLAYER[number]) && !is_none_value(value as string)) {
                match[name] = value
            }
        }

        for (const [key, value] of Object.entries(match_raw)) {
            const name = key as typeof SC.META[number]

            if (!SC.META.includes(name)) continue

            if (name === C.RESULT) {
                if (value === 'win') {
                    match[name] = MatchResultMpSchema.enum.WIN
                } else if (value === 'loss') {
                    match[name] = MatchResultMpSchema.enum.LOSS
                } else {
                    match[name] = MatchResultMpSchema.enum.DRAW
                }
                continue
            }

            match[name] = value
        }

        for (const [key, value] of Object.entries(match_raw.playerStats)) {
            const name = SC.RENAME_TO_BASIC[key] || key

            if (this.GAME_COLUMNS[game_mode].includes(name)) {
                match[name] = value
            } else {
                SC.new_columns.add(name)
            }
        }

        const is_mw = is_game_mode_mw(game_mode)

        if (!is_mw && match[C.WEAPON_STATS]) {
            delete match[C.WEAPON_STATS]
        }
        if (!is_mw && match[C.LOADOUT]) {
            delete match[C.LOADOUT]
        }

        for (const [name, value] of Object.entries(match)) {
            if (SC.ROUND.includes(name as typeof SC.ROUND[number])) {
                match[name] = round_number(value as number)
            } else if (name === C.DURATION || name === 'teamSurvivalTime') {
                match[name] = value as number / 1000
            } else if (name === C.ACCURACY) {
                match[name] = round_number(value as number * 100)
            } else if (name == C.LOADOUT) {
                match[name] = await this.encode_loadouts(value as LoadoutRaw[], game_mode)
            } else if (name == C.WEAPON_STATS) {
                const encoded_weapon_stats = await this.encode_weapon_stats(value as WeaponStatsRaw, game_mode)
                if (encoded_weapon_stats) {
                    match[name] = encoded_weapon_stats
                }
            } else {
                match[name] = value
            }
        }

        return match
    }

    async encode_loadout(loadout: LoadoutRaw, game_mode: GameModeOnly) {
        const encoded_loadout = []

        for (const weapon_type of this.WEAPON_TYPES) {
            const encoded = []

            if (weapon_type === 'primaryWeapon' || weapon_type === 'secondaryWeapon') {
                const weapon = loadout[weapon_type]
                const weapon_index = await this.get_index(
                    weapon.name, weapon.label, 'weapons', game_mode
                )

                if (weapon_index) {
                    // first element is weapon index
                    encoded.push(weapon_index)

                    for (const attachment of weapon.attachments) {
                        const attachment_index = await this.get_index(
                            attachment.name, attachment.label, 'attachments', game_mode
                        )
                        if (attachment_index) {
                            // rest elements is attachments
                            encoded.push(attachment_index)
                        }
                    }
                }
            } else if (weapon_type === 'perks') {
                const all_perks = loadout[weapon_type].concat(loadout.extraPerks)

                for (const perk of all_perks) {
                    const perk_name = perk.name.replace('specialty_', '')
                    const perk_index = await this.get_index(
                        perk_name, perk.label, weapon_type, game_mode
                    )
                    if (perk_index) {
                        encoded.push(perk_index)
                    }
                }
            } else if (weapon_type === 'killstreaks') {
                const killstreaks = loadout[weapon_type]

                for (const killstreak of killstreaks) {
                    const killstreak_index = await this.get_index(
                        killstreak.name, killstreak.label, weapon_type, game_mode
                    )
                    if (killstreak_index) {
                        encoded.push(killstreak_index)
                    }
                }
            } else if (weapon_type === 'tactical' || weapon_type === 'lethal') {
                const equip = loadout[weapon_type]
                const equip_name = equip.name.replace('equip_', '')
                const equip_index = await this.get_index(
                    equip_name, equip.label, weapon_type, game_mode
                )
                if (equip_index) {
                    encoded.push(equip_index)
                }
            }

            encoded_loadout.push(encoded.join(this.SPLIT_ON_INDEXES))
        }

        return encoded_loadout.join(this.SPLIT_ON_WEAPONS)
    }

    async encode_loadouts(loadouts: LoadoutRaw[], game_mode: GameModeOnly) {
        const encoded_loadouts: string[] = []
        loadouts.forEach(async loadout => {
            const encoded_loadout = await this.encode_loadout(loadout, game_mode)
            if (encoded_loadout) {
                encoded_loadouts.push(encoded_loadout)
            }
        })
        return encoded_loadouts.join(this.SPLIT_ON_LOADOUTS)
    }

    async encode_weapon_stats(weapon_stats: WeaponStatsRaw, game_mode: GameModeOnly) {
        const encoded_stats: string[] = []

        for (const [weapon_name, stats] of Object.entries(weapon_stats)) {
            const weapon_index = await this.get_index(weapon_name, null, 'weapons', game_mode)
            if (!weapon_index) continue

            const stat_values = this.STAT_TYPES.map(stat_type => stats[stat_type].toString())
            const encoded_stat = [weapon_index, ...stat_values].join(this.SPLIT_ON_INDEXES)
            encoded_stats.push(encoded_stat)
        }

        return encoded_stats.join(this.SPLIT_ON_LOADOUTS) || null
    }

    async decode_loadout(loadouts_raw: string | null) {
        const decoded_loadouts: MatchLoadout[] = []
        if (!loadouts_raw) return decoded_loadouts

        const loadouts = loadouts_raw.split(this.SPLIT_ON_LOADOUTS)

        for (const loadout of loadouts) {
            const decoded_loadout = {} as MatchLoadout
            const weapons = loadout.split(this.SPLIT_ON_WEAPONS)
            let index = 0

            for (const weapon_type of this.WEAPON_TYPES) {
                const weapon_indexes = weapons[index].split(this.SPLIT_ON_INDEXES)

                if (weapon_type === 'primaryWeapon' || weapon_type === 'secondaryWeapon') {
                    // removed first element is a weapon index and the rest is attachments indexes
                    const weapon_index = weapon_indexes.shift()!
                    const weapon: MatchLoadoutWeapon = {
                        ...await this.get_label_data(weapon_index, 'weapons'),
                        attachments: [],
                    }

                    for (const attachment_index in weapon_indexes) {
                        const attachment = await this.get_label_data(attachment_index, 'attachments')
                        weapon.attachments.push(attachment)
                    }

                    decoded_loadout[weapon_type] = weapon

                } else if (weapon_type === 'perks' || weapon_type === 'killstreaks') {
                    const label_datas: LabelData[] = []
                    for (const index of weapon_indexes) {
                        if (!index) continue
                        const label_data = await this.get_label_data(index, weapon_type)
                        label_datas.push(label_data)
                    }
                    decoded_loadout[weapon_type] = label_datas

                } else if (weapon_type === 'tactical' || weapon_type === 'lethal') {
                    const equip_index = weapon_indexes[0]
                    if (equip_index) {
                        decoded_loadout[weapon_type] = await this.get_label_data(equip_index, weapon_type)
                    } else {
                        decoded_loadout[weapon_type] = null
                    }
                }

                decoded_loadouts.push(decoded_loadout)
                index++
            }
        }

        return decoded_loadouts
    }

    async decode_weapon_stats(weapon_stats_raw: string | null) {
        const decoded_weapon_stats: MatchLoadoutDataStats[] = []

        if (!weapon_stats_raw) return decoded_weapon_stats

        const weapon_stats = weapon_stats_raw.split(this.SPLIT_ON_LOADOUTS)

        for (const encoded_weapon_stat_raw of weapon_stats) {
            const encoded_weapon_stat = encoded_weapon_stat_raw.split(this.SPLIT_ON_INDEXES)

            // removed first element is a weapon index and the rest is weapon stat values
            const weapon_index = encoded_weapon_stat.shift()!
            const decoded_weapon_stat: MatchLoadoutDataStats = {
                ...await this.get_label_data(weapon_index, 'weapons'),
                stats: {
                    hits: 0,
                    kills: 0,
                    headshots: 0,
                    shots: 0,
                    startingWeaponXp: 0,
                    deaths: 0,
                    xpEarned: 0
                },
            }

            let stat_index = 0
            this.STAT_TYPES.forEach(stat_type => {
                decoded_weapon_stat.stats[stat_type] = +encoded_weapon_stat[stat_index]
                stat_index++
            })

            decoded_weapon_stats.push(decoded_weapon_stat)
        }
        return decoded_weapon_stats
    }

    async format_loadout(player_loadouts: string[]) {
        /** Count (Primary + Secondary) weapon loadout */
        const loadout: Record<string, number> = {}

        for (const loadouts of player_loadouts) {
            const decoded_loadouts = await this.decode_loadout(loadouts)

            for (const decoded_loadout of decoded_loadouts) {
                const weapon_names: string[] = []

                for (const weapon_name of ['primaryWeapon', 'secondaryWeapon'] as const) {
                    weapon_names.push(decoded_loadout[weapon_name].label || decoded_loadout[weapon_name].name)
                }
                const weapon_name = weapon_names.join(' + ')
                if (weapon_name in loadout) {
                    loadout[weapon_name]++
                } else {
                    loadout[weapon_name] = 1
                }
            }
        }

        return loadout
    }
}

export const MF = await MatchFormatter.create()
