/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
} from 'react'
import { C } from '@/app/components/Consts'
import { is_number } from '@/app/components/UtilsValidators'
import {
    capitalize,
    local_profile_manage,
    get_user_language,
    translate_get,
} from '@/app/components/UtilsClient'
import {
    PROFILE,
    UserProfile,
} from '@/app/components/zod/User'
import {
    Language,
    Translate,
} from '@/app/components/zod/Language'

const context: {
    t: (word: unknown) => string
    s: (stat: string) => string

    profile: UserProfile
    set_profile: (
        profile: UserProfile | undefined,
        update_local_profile: boolean,
        refresh_page: boolean
    ) => void

    modal_open: (content: React.ReactNode) => void
    modal_close: () => void
} = {
    t: (word: unknown) => '',
    s: (stat: string) => '',

    profile: PROFILE,
    set_profile: (
        profile: UserProfile | undefined,
        update_local_profile: boolean,
        refresh_page: boolean
    ) => null,

    modal_open: (content: React.ReactNode) => null,
    modal_close: () => null,
}

const AppContext = createContext(context)
export default function useAppContext() { return useContext(AppContext) }

export const AppWrapper = ({ children }: { children: React.ReactNode }) => {
    const [profile, setProfile] = useState<UserProfile>({
        ...PROFILE,
        language: local_profile_manage().language
    })
    const [translate, setTranslate] = useState<
        Record<Translate, Record<string, Record<Language, string | null> | undefined>>
    >()
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null)
    const modal: React.RefObject<HTMLDialogElement | null> = useRef(null)

    useEffect(() => {
        set_profile(local_profile_manage(), false, false)
        translate_get().then(translate => setTranslate(translate))
    }, [])

    const translate_text = (text: unknown) => {
        if (!text) return ''
        if (typeof text !== 'string') {
            try { return JSON.stringify(text) }
            catch { return '' }
        }
        if (!translate) return text
        if (!text.trim()) return ''

        const translate_word = (word: string) => {
            if (word[0] === '[') {
                return word.slice(1, word.at(-1) === ']' ? -1 : undefined)
            }
            if (word.at(-1) === ']') {
                return word.slice(0, -1)
            }
            if (is_number(word) || word.replace(/[^a-zA-Z0-9 ]/g, '') === '') {
                return word
            }

            const translated = translate.translate[word.toLowerCase()]?.[profile.language]
            if (translated) return translated

            // default language can be without translate
            if (profile.language !== PROFILE.language) {
                // show not translated word
                console.log(word)
            }

            return word
        }

        const translated_words = text.split(' ').filter(Boolean).map(word => translate_word(word))
        translated_words[0] = capitalize(translated_words[0])

        return translated_words.join(' ')
    }

    const translate_stat = (stat: string): string => {
        if (!stat?.trim()) return ''
        if (stat.includes('objective')) {
            stat = stat
                .replace(/objective|Br|Medal|Score|Ss/g, '')
                .replace(/([A-Z])/g, ' $1')
                .trim()
        }
        if (!translate) return stat

        const stat_name = stat.toLowerCase()
        const has_translate = (
            translate.translate_stats[stat_name] ||
            translate.translate[stat_name]
        )

        return has_translate?.[profile.language] || stat
    }

    const set_profile = (
        user_profile: UserProfile | undefined,
        update_local_profile: boolean,
        refresh_page: boolean
    ) => {
        const new_profile = user_profile || {
            ...PROFILE,
            language: local_profile_manage().login === C.GUEST ?
                get_user_language() : profile.language
        }

        if (!user_profile || update_local_profile) {
            local_profile_manage(new_profile)
        }

        setProfile(new_profile)

        if (refresh_page && typeof window !== 'undefined') {
            window.location.reload()
        }
    }

    const modal_open = (content: React.ReactNode) => {
        setModalContent(content)
        modal.current?.showModal()
    }

    const modal_close = () => {
        setModalContent(null)
        modal.current?.close()
    }

    const shared_state: typeof context = {
        t: translate_text,
        s: translate_stat,

        profile,
        set_profile,

        modal_open,
        modal_close,
    }

    return (
        <AppContext.Provider value={shared_state}>
            <dialog
                id="modal"
                ref={modal}
                className="
                z-[7] p-4 top-0 h-full min-h-screen min-w-[100vw]
                flex flex-col justify-center items-center
                backdrop-blur-sm bg-transparent
                opacity-0 scale-0 transition-all
                open:opacity-100 open:scale-100"
                onClick={event => {
                    if ((event.target as HTMLElement).id === 'modal') {
                        modal_close()
                    }
                }}
            >{modalContent}</dialog>
            {children}
        </AppContext.Provider>
    )
}
