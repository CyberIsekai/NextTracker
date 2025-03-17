'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useAppContext from '@/app/components/AppContext'
import { IconGameMode, IconCross } from '@/app/components/Icons'
import { C } from '@/app/components/Consts'
import {
    format_label_data,
    get_map_img,
    router_generate_url,
    date_format,
    get_result_color,
    fetch_request,
} from '@/app/components/UtilsClient'
import {
    game_mode_split,
    GAME_MODE_TITLES,
} from '@/app/components/zod/GameMode'
import { LabelData } from '@/app/components/zod/Label'
import {
    MatchLoadout,
    MatchLoadoutWeapon,
    MatchStatsPlayer,
    MatchBody,
    MatchLoadoutDataStats,
    MATCH_RESULT_MP,
    MatchResultMp,
} from '@/app/components/zod/Match'

export default function MatchStatsCard({ match_body, is_modal }: {
    match_body: MatchBody
    is_modal?: boolean
}) {
    const searchParams = useSearchParams()
    const { push } = useRouter()
    const { t, s, modal_close } = useAppContext()
    const [player, setPlayer] = useState<MatchStatsPlayer>()
    const [error, setError] = useState('')

    const { game_mode, match_id, source, year } = match_body
    const [game, mode] = game_mode_split(game_mode)
    const is_mw = [C.MW_MP, C.MW_WZ].includes(game_mode)
    const follow = searchParams.get('follow') || ''

    const load_match_stats = async () => {
        const uid = `match_stats_${game_mode}_${match_id}_${source}_${year}`
        let match_stats: MatchStatsPlayer & { detail?: string } | undefined

        const saved_stats = sessionStorage.getItem(uid)
        if (saved_stats) {
            match_stats = JSON.parse(saved_stats)
        } else {
            match_stats = await fetch_request<MatchStatsPlayer>('match_stats', match_body)
            sessionStorage.setItem(uid, JSON.stringify(match_stats))
        }

        if (!match_stats || match_stats.detail) {
            setError(match_stats?.detail || `${C.MATCH} ${C.STATS} ${C.ERROR}`)
        } else {
            setError('')
            setPlayer(match_stats)
        }
    }

    useEffect(() => {
        load_match_stats()
    }, [])

    if (!player) return <div>{t(C.LOADING)}...</div>
    if (error) return <div>{t(error)}</div>

    const url = `/match_stats/${game_mode}/${player.id}/${source}/${year}/`

    const load_url = (url: string) => {
        if (is_modal) {
            modal_close()
        }
        push(url)
    }

    return (
        <div
            className="pb-2 text-white text-center rounded-xl shadow-md w-[65vw] bg-cover bg-center"
            style={{
                backgroundImage: `
                linear-gradient(
                  180deg,
                  rgb(30, 36, 57, 0.2),
                  10%,
                  rgba(30, 36, 57, 0.6)),
                  url('${get_map_img(game_mode, player.map.name)}'
                )`
            }}
        >
            <title>{`${player.username} | ${GAME_MODE_TITLES[game_mode]}`}</title>
            <header
                className={`
                    p-3 flex items-center gap-2 justify-between h-12 relative rounded-t-xl
                    ${get_result_color(player.result, game_mode, 'bg')}`}
            >
                <button
                    type="button"
                    title={GAME_MODE_TITLES[game_mode]}
                    onClick={() => load_url(router_generate_url({ data_type: C.MATCHES, target: C.ALL, game, mode }))}
                ><IconGameMode game_mode={game_mode} /></button>

                {is_mw && (
                    <button
                        type="button"
                        className="link text-amber-500"
                        title={`${t('open fullmatch')} ${player.matchID}`}
                        onClick={() => load_url(`/match/${player.matchID}/${game_mode}?follow=${player.uno}`)}
                    >{date_format(player.time)}</button>
                )}

                {mode === C.MP ? <>
                    <span>{t(MATCH_RESULT_MP[player.result as MatchResultMp])}</span>
                    {player.stats.team1Score && player.stats.team2Score && (
                        <span>{player.stats.team1Score} - {player.stats.team2Score}</span>
                    )}
                </> : player.result > 0 && (
                    <span>{t(C.PLACE)} {player.result}</span>
                )}

                <span title={player.mode.name}>
                    <span>{format_label_data(player.map)} </span>
                    <span>[{format_label_data(player.mode)}]</span>
                </span>

                {([C.USERNAME, C.CLANTAG, C.UNO] as const)
                    .filter(stat => player[stat])
                    .map(stat => {
                        const value = player[stat]
                        if (!value || (!is_mw && stat == C.CLANTAG)) {
                            return (
                                <span key={`stat_${stat}`}>{value}</span>
                            )
                        }
                        return (
                            <button
                                key={`${C.SEARCH}_${stat}`}
                                type="button"
                                className="link text-amber-500"
                                title={`${t(`${C.SEARCH} ${stat}`)} ${value}`}
                                onClick={() => load_url(router_generate_url({
                                    data_type: stat, target: encodeURIComponent(value), game, mode
                                }))}
                            >{value}</button>
                        )
                    })}

                {is_modal && <>
                    <button
                        type="button"
                        className="link text-amber-500"
                        title={t(`open ${C.MATCH}`)}
                        onClick={() => load_url(url)}
                    >{player.id}</button>
                    <button
                        type="button"
                        className="link text-amber-500"
                        title={t('close modal ?')}
                        onClick={() => modal_close()}
                    ><IconCross /></button>
                </>}
            </header>

            <div
                className={`
                    grid grid-cols-6 rounded-b-xl font-bold bg-gradient-to-b to-transparent
                    ${get_result_color(player.result, game_mode, 'from')}`}
            >
                <Loadouts match_loadouts={player.loadout} />
                <WeaponStats match_weapon_stats={player.weaponStats} />
                {Object.entries(player.stats).map(([stat_name, stat_value]) => (
                    <button
                        key={stat_name}
                        type="button"
                        className={stat_name === follow ? 'bg-orange-500/40' :
                            'bg-sky-500/10 hover:bg-sky-500/20 rounded'}
                        onClick={() => load_url(stat_name === follow ? url : `${url}?follow=${stat_name}`)}
                    >
                        <p>{s(stat_name)}</p>
                        <p className="text-blue-300">{stat_value.toLocaleString()}</p>
                    </button>
                ))}
            </div>
        </div >
    )
}

const Loadouts = ({ match_loadouts }: { match_loadouts: MatchLoadout[] }) => {
    const { t } = useAppContext()

    if (!match_loadouts.length) return null

    const RenderLoadoutData = ({ label_data }: { label_data: LabelData | null }) => (
        !label_data ? null : (
            <li>
                <span title={label_data.name}>
                    {format_label_data(label_data)}
                </span>
            </li>
        )
    )

    const Weapon = ({ weapon, weapon_type }: {
        weapon: MatchLoadoutWeapon | null,
        weapon_type: 'primary' | 'secondary'
    }) => {
        if (!weapon) return <li><span>{t(`${weapon_type} ${C.NOT_FOUND}`)}</span></li>

        return (
            <li>
                <span title={`${t(`${weapon_type} weapon`)} - ${weapon.name}`}>
                    {format_label_data(weapon)}
                </span>
                <ul>
                    {weapon.attachments.length ? (
                        <li>
                            <span>{t('attachments')} [{weapon.attachments.length}]</span>
                            <ul>
                                {weapon.attachments.map(attachment => (
                                    <RenderLoadoutData key={attachment.name} label_data={attachment} />
                                ))}
                            </ul>
                        </li>
                    ) : (
                        <li><span>{t('no_attachments')}</span></li>
                    )}
                </ul>
            </li>
        )
    }

    const loadouts = match_loadouts.map((loadout, loadout_index) => (
        <li key={`loadout_${loadout_index}`}>
            <span>{loadout_index + 1}</span>
            <ul>
                <Weapon weapon={loadout.primaryWeapon} weapon_type={'primary'} />
                <Weapon weapon={loadout.secondaryWeapon} weapon_type={'secondary'} />
                {loadout.perks.length > 0 && (
                    <li>
                        <span>{t('perks')}</span>
                        <ul>
                            {loadout.perks.map(perk => (
                                <RenderLoadoutData key={perk.name} label_data={perk} />
                            ))}
                        </ul>
                    </li>
                )}
                {loadout.killstreaks.length > 0 && (
                    <li>
                        <span>{t('killstreaks')}</span>
                        <ul>
                            {loadout.killstreaks.map(killstreak => (
                                <RenderLoadoutData key={killstreak.name} label_data={killstreak} />
                            ))}
                        </ul>
                    </li>
                )}
                <RenderLoadoutData label_data={loadout.tactical} />
                <RenderLoadoutData label_data={loadout.lethal} />
            </ul>
        </li>
    ))

    return (
        <ul className="loadout-dropdown-menu bg-sky-500/10 hover:bg-sky-500/20">
            <li className="flex flex-col items-center">
                <span>{t(C.LOADOUT)} [{match_loadouts.length}]</span>
                <ul>{loadouts}</ul>
            </li>
        </ul>
    )
}

const WeaponStats = ({ match_weapon_stats }: { match_weapon_stats: MatchLoadoutDataStats[] }) => {
    const { t } = useAppContext()

    if (!match_weapon_stats.length) return null

    const stats = match_weapon_stats.map(weapon_stats => (
        <li key={`weapon_${weapon_stats.name}`}>
            <span title={weapon_stats.name}>
                {format_label_data(weapon_stats)}
            </span>
            <ul>
                {Object.entries(weapon_stats.stats)
                    .filter(([, value]) => value)
                    .map(([name, value]) => (
                        <li key={`${name}_${value}`}>
                            <span>{t(name)}: {value}</span>
                        </li>
                    ))}
            </ul>
        </li>
    ))

    return (
        <ul className="loadout-dropdown-menu bg-sky-500/10 hover:bg-sky-500/20">
            <li className="flex flex-col items-center">
                <span>{t(`weapon ${C.STATS}`)}</span>
                <ul>{stats}</ul>
            </li>
        </ul>
    )
}
