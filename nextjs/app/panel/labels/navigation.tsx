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
import { LabelType, LabelTypeSchema } from '@/app/components/zod/Label'

const LabelsContext = createContext({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tab_update: (label_type: LabelType, count: number) => { },
    count: 0,
})
export const useLabelsContext = () => useContext(LabelsContext)

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { t } = useAppContext()

    const [tabs, setTabs] = useState<Record<LabelType, number>>()
    const [error, setError] = useState('')

    const fetch_data = async () => {
        const res = await fetch_request<Record<LabelType, number>>('labels')
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

    const tab_update = (label_type: LabelType, count: number) => setTabs(prev => {
        if (!prev) return prev
        if (count === -1) {
            return { ...prev, [label_type]: prev[label_type] - 1 }
        }
        return { ...prev, [label_type]: count }
    })

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

    const current_label_type = LabelTypeSchema.parse(pathname.split('/')[3] || C.MAP)
    const shared_state = { tab_update, count: tabs[current_label_type] || 0 }

    return (
        <LabelsContext.Provider value={shared_state}>
            <div className="p-1 inline-flex justify-center">
                {Object.entries(tabs).map(([label_type, count]) => (
                    <Link
                        key={label_type}
                        className={`
                                button-style-cyan flex gap-1 first:rounded-l last:rounded-r
                                ${label_type === current_label_type ? 'opacity-75' : ''}`}
                        href={`/panel/labels/${label_type}`}
                    >
                        <span>{t(label_type)}</span>
                        <span>[{count}]</span>
                    </Link>
                ))}
            </div>
            {children}
        </LabelsContext.Provider>
    )
}
