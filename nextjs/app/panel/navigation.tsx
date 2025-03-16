'use client'

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
} from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useAppContext from '@/app/components/AppContext'
import {
    C,
    TIME_LOAD_DELAY,
} from '@/app/components/Consts'
import { fetch_request } from '@/app/components/UtilsClient'
import { Panel } from '@/app/components/zod/Panel'

const PanelContext = createContext<{
    panel?: Panel
    fetch_data: () => Promise<void>
    panel_page_count_update: (sub_page: string, count: number) => void
}>({
    panel: undefined,
    fetch_data: () => new Promise(() => { }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    panel_page_count_update: (sub_page: string, count: number) => { },
})
export const usePanelContext = () => useContext(PanelContext)

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { t, profile } = useAppContext()

    const [panel, setPanel] = useState<Panel>()
    const [error, setError] = useState('')
    const loading = useRef(false)

    const fetch_data = async () => {
        if (loading.current) return
        loading.current = true
        const res = await fetch_request<Panel>('panel')
        if (!res || res.detail) {
            setError(res?.detail || `${C.DATA} ${C.NOT_FOUND}`)
        } else {
            setPanel(res)
            setError('')
        }
        new Promise(r => setTimeout(r, TIME_LOAD_DELAY)).then(() => loading.current = false)
    }

    const panel_page_count_update = (sub_page: string, count: number) => setPanel(prev => {
        if (!prev) return prev
        return {
            ...prev,
            pages: {
                ...prev.pages,
                [sub_page]: count,
            }
        }
    })

    useEffect(() => {
        fetch_data()
    }, [profile])

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

    const current_tab = pathname.split('/')[2] || C.MAIN
    const shared_state = { panel, fetch_data, panel_page_count_update }

    return (
        <PanelContext.Provider value={shared_state}>
            <div className="p-1 inline-flex justify-center">
                {Object.entries(panel?.pages || {}).map(([sub_page, count]) => (
                    <Link
                        key={sub_page}
                        className={`
                            button-style-cyan first:rounded-l last:rounded-r
                            ${current_tab === sub_page ? 'opacity-75' : ''}`}
                        href={`/panel/${sub_page === C.MAIN ? '' : sub_page}`}
                    >{t(sub_page)} {count !== null && `[${count}]`}</Link>
                ))}
            </div>
            {children}
        </PanelContext.Provider>
    )
}
