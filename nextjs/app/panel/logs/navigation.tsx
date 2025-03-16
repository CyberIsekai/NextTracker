'use client'

import {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useAppContext from '@/app/components/AppContext'
import { C } from '@/app/components/Consts'
import { fetch_request } from '@/app/components/UtilsClient'
import { usePanelContext } from '../navigation'
import { LogsSource, LogsSourceSchema } from '@/app/components/zod/Logs'

const LogsContext = createContext({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tab_update: (logs_source: LogsSource, logs_count: number) => { },
    count: 0,
})
export const useLogsContext = () => useContext(LogsContext)

const logs_source_format = (logs_source: string) => (
    logs_source.split('_').filter(word => word !== C.LOGS).join(' ') || C.LOGS
)

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { t } = useAppContext()

    const { panel_page_count_update } = usePanelContext()

    const [tabs, setTabs] = useState<Record<LogsSource, number>>()
    const [error, setError] = useState('')

    const fetch_data = async () => {
        const res = await fetch_request<Record<LogsSource, number>>('logs')
        if (!res || res.detail) {
            setError(res?.detail || `${C.DATA} ${C.NOT_FOUND}`)
        } else {
            setError('')
            setTabs(res)
        }
    }

    useEffect(() => {
        fetch_data()
    }, [])

    const tab_update = (logs_source: LogsSource, logs_count: number) => {
        setTabs(prev => {
            if (!prev) return prev
            if (logs_source === C.ALL) {
                for (const logs_source of LogsSourceSchema.options) {
                    prev[logs_source] = 0
                }
            } else if (logs_count === -1) {
                prev[logs_source] -= 1
                prev.all -= 1
            } else {
                prev[logs_source] = logs_count
                prev.all = 0
                prev.all = Object.values(prev).reduce((logs, count) => logs + count, 0)
            }
            return { ...prev }
        })

        new Promise(r => setTimeout(r, 100)).then(() =>
            tabs && panel_page_count_update(C.LOGS, tabs.all)
        )
    }

    if (error) {
        return (
            <h3 className='text-center'>
                <span>{t(error)} </span>
                <button
                    type='button'
                    className='link text-white'
                    onClick={fetch_data}
                >{t(C.REFRESH)}</button>
            </h3>
        )
    }

    if (!tabs) return <div>{t(C.LOADING)}...</div>

    const current_logs_source = LogsSourceSchema.parse(pathname.split('/')[3] || C.ALL)
    const shared_state = { tab_update, count: tabs[current_logs_source] || 0 }

    return (
        <LogsContext.Provider value={shared_state}>
            <title>{t(`${C.LOGS} ${logs_source_format(current_logs_source)}`)}</title>
            <div className="p-1 inline-flex justify-center">
                {Object.entries(tabs).map(([logs_source, logs_count]) => (
                    <Link
                        key={logs_source}
                        className={`
                                button-style-cyan flex gap-1 first:rounded-l last:rounded-r
                                ${logs_source === current_logs_source ? 'opacity-75' : ''}`}
                        href={`/panel/logs/${logs_source}`}
                    >
                        <span>{t(logs_source_format(logs_source))}</span>
                        <span>[{logs_count}]</span>
                    </Link>
                ))}
            </div>
            {children}
        </LogsContext.Provider>
    )
}
