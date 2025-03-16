'use client'

import useAppContext from '@/app/components/AppContext'
import { C } from '@/app/components/Consts'
import { get_percent } from '@/app/components/UtilsClient'
import { MatchesStats } from '@/app/components/zod/GameStatus'

export default function MatchStatsProgress({ matches_stats }: { matches_stats: MatchesStats }) {
    const { t } = useAppContext()

    const completed_matches = get_percent(
        matches_stats.fullmatches, matches_stats.matches
    )

    return <>
        {matches_stats.played > 0 && <p>{t(C.PLAYED)}: {matches_stats.played}</p>}
        <p>{t(C.MATCHES)}: {matches_stats.matches.toLocaleString()}</p>
        {completed_matches > 0 && <>
            <p>{t(C.FULLMATCHES)}: {matches_stats.fullmatches.toLocaleString()}</p>
            <p>{t(C.COMPLETED)}: {completed_matches} %</p>
            <label>
                <progress
                    max="100"
                    value={completed_matches}
                    className="text-green-500"
                >{completed_matches}%</progress>
            </label>
        </>}
    </>
}
