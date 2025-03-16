'use client'

import { useEffect, useState } from 'react'
import useAppContext from '@/app/components/AppContext'
import { C } from '@/app/components/Consts'
import {
    order_change,
    order_status,
    fetch_request,
} from '@/app/components/UtilsClient'
import {
    IconTrash,
    IconUpdate
} from '@/app/components/Icons'
import {
    RequestMethod,
    RequestMethodSchema,
} from '@/app/components/zod/Main'
import {
    Translate,
    TranslateSchema,
    TranslatesResponse,
    TranslatesWord,
    TranslatesWordSchema,
    TranslatesWordKey,
    TranslatesWordKeySchema,
} from '@/app/components/zod/Language'

const word_blank = TranslatesWordSchema.parse({
    id: -1, name: '', en: null, ru: null
})

export default function Translates() {
    const { t } = useAppContext()
    const [translate, setTranslate] = useState<Record<Translate, TranslatesWord[]>>({
        translate: [],
        translate_stats: []
    })
    const [currentTab, setCurrentTab] = useState<Translate>(TranslateSchema.options[0])
    const [order, setOrder] = useState(order_status<TranslatesWordKey>('-id'))
    const [error, setError] = useState('')

    const fetch_data = async () => {
        const res = await fetch_request<TranslatesResponse>(`translate/${currentTab}`)

        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
        } else {
            setError('')
            setTranslate(prev => ({
                ...prev,
                [currentTab]: res.translate
            }))
        }
    }

    useEffect(() => {
        if (translate[currentTab].length) return
        fetch_data()
    }, [currentTab])

    const sort = (set_order: TranslatesWordKey) => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        const { new_order, is_desc } = order_change(order.current, set_order)
        setOrder(order_status<TranslatesWordKey>(new_order))
        setTranslate(prev => ({
            ...prev,
            [currentTab]: [...prev[currentTab].sort((a, b) => {
                let a_count = a[set_order]
                let b_count = b[set_order]

                if (a_count === null) return 1
                if (b_count === null) return -1

                if (is_desc) {
                    [a_count, b_count] = [b_count, a_count]
                }

                if (typeof a_count === 'number' && typeof b_count === 'number') {
                    return a_count - b_count
                }
                if (typeof a_count === 'string' && typeof b_count === 'string') {
                    return a_count.localeCompare(b_count)
                }
                return 0
            })]
        }))
    }

    const manage = async (word: TranslatesWord, method: RequestMethod) => {
        if (method === RequestMethodSchema.enum.DELETE && !confirm(`${t(C.DELETE)} word [${word.name}] ?`)) {
            return
        } else if (!word.name.trim()) {
            return
        }

        const word_index_by_name = translate[currentTab].findIndex(
            _word => _word.name === word.name
        )

        if (method === RequestMethodSchema.enum.POST && word_index_by_name !== -1) {
            const component = document.getElementById(word.name)
            if (component) {
                component.className = 'bg-yellow-400/10'
                component.scrollIntoView({ block: 'center', inline: 'nearest' })
                return
            }
        }

        const res = await fetch_request<TranslatesWord>(
            `translate/${currentTab}`, word, method
        )

        if (!res || res.detail) {
            setError(res?.detail || C.ERROR)
            return
        }

        setTranslate(prev => {
            if (method === RequestMethodSchema.enum.DELETE) {
                prev = {
                    ...prev,
                    [currentTab]: prev[currentTab].filter(word => word.id !== res.id)
                }
            } else if (method === RequestMethodSchema.enum.POST) {
                prev = {
                    ...prev,
                    [currentTab]: [res, ...prev[currentTab]]
                }
            } else if (method === RequestMethodSchema.enum.PUT) {
                let word_index = prev[currentTab].findIndex(word => word.id === res.id)
                if (word_index === -1) {
                    word_index = word_index_by_name
                }
                if (word_index !== -1) {
                    prev[currentTab][word_index] = res
                    prev = { ...prev }
                }
            }
            return prev
        })
    }

    const TextForm = ({ word, name }: {
        word: TranslatesWord,
        name: TranslatesWordKey
    }) => {
        const [showForm, setShowForm] = useState(false)

        if (!showForm) {
            return (
                <button
                    type="button"
                    title={t(`click for change ${name}`)}
                    onClick={() => setShowForm(true)}
                >{word[name] === null ? <span className="text-2xl">+</span> : word[name]}</button>
            )
        }

        return (
            <input
                type="text"
                className="p-1 bg-transparent"
                title={t(`hit enter for apply change`)}
                placeholder={t(name)}
                defaultValue={word[name] || ''}
                onKeyDown={e => {
                    if (e.code === 'Enter') {
                        const target = e.target as HTMLInputElement
                        manage({
                            ...word,
                            [name]: name === C.ID ? +target.value : target.value
                        }, RequestMethodSchema.enum.PUT)
                        setShowForm(false)
                    }
                }}
                autoFocus
            />
        )
    }

    return <>
        <title>{t(C.TRANSLATE)}</title>

        <div className="p-1 flex">
            {TranslateSchema.options.map(translate => (
                <button
                    type="button"
                    key={translate}
                    className="button-style-cyan first:rounded-l last:rounded-r"
                    disabled={currentTab === translate}
                    onClick={() => setCurrentTab(translate)}
                >{t(translate.split('_').join(' '))}</button>
            ))}
        </div>

        <div className="p-2 flex gap-2">
            <input
                type="text"
                className="p-1 text-center bg-gray-800 rounded"
                placeholder={t(`${C.SEARCH} or add word`)}
                onKeyDown={e => {
                    if (e.code === 'Enter') {
                        const target = e.target as HTMLInputElement
                        manage({ ...word_blank, name: target.value }, RequestMethodSchema.enum.POST)
                        target.value = ''
                    }
                }}
            />
            <button
                type='button'
                className="link text-white disabled:opacity-75"
                title={t(C.REFRESH)}
                onClick={fetch_data}
            ><IconUpdate /></button>
        </div>

        <p className="message-error">{t(error)}</p>

        <table className="table_logs">
            <thead className="sticky-top top-1">
                <tr>
                    {TranslatesWordKeySchema.options.map(column => {
                        const is_asc = order.column === column && !order.is_desc
                        const is_desc = order.column === column && order.is_desc
                        return (
                            <th key={column}>
                                <button
                                    type="button"
                                    onClick={() => sort(column)}
                                    title={t(` click for ${C.ORDER} by ${column}`)}
                                >{t(column)}</button>
                                <span className="float-right">
                                    {is_asc ? '↑' : is_desc ? '↓' : ''}
                                </span>
                            </th>
                        )
                    })}
                    <th>{t(C.DELETE)}</th>
                </tr>
            </thead>
            <tbody>
                {translate[currentTab].map(word => (
                    <tr key={word.name} id={word.name}>
                        {TranslatesWordKeySchema.options.map(name => (
                            <td key={name}>
                                <TextForm word={word} name={name} />
                            </td>
                        ))}
                        <td className="text-center">
                            <button
                                type="button"
                                className="text-red-600"
                                title={t(`${C.DELETE} word ?`)}
                                onClick={() => manage(word, RequestMethodSchema.enum.DELETE)}
                            ><IconTrash /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </>
}
