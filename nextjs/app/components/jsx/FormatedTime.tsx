'use client'

import { date_format, get_ago } from '@/app/components/UtilsClient'

const FormatedTime = ({ time, title = '' }: { time: string, title?: string }) => (
    <div className="dropdown">
        {title} {get_ago(time)}
        <span className="popUp">{date_format(time)}</span>
    </div>
)

export default FormatedTime