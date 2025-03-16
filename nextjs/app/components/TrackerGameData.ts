import { C } from '@/app/components/Consts'
import { PlatformOnly } from '@/app/components/zod/Main'
import { GameModeOnly } from '@/app/components/zod/GameMode'


// export const get_url = (
//     target: string,
//     game_mode: GameModeOnly,
//     data_type: DataType,
//     platform: Platform,
//     start_time: number
// ) => {
//     /**
//     # MATCHES
//     uno/gamer/Stikinson%231007442' activision id \n
//     uno/uno/18314460775731398053' uno \n
//     battle/gamer/Stikinson%232924' battle tag \n

//     # SEARCH
//     uno/username/Stikinson%231007442/search' activision id \n
//     uno/username/Stikinson/search' activision id and uno \n
//     battle/username/Stikinson/search' battle tag
//     */

//     target = target.replace('#', '%23')
//     const [game, mode] = game_mode.split('_')
//     const search_type: 'gamer' | C.UNO = platform === C.UNO ? platform : 'gamer'
//     platform = platform === C.ACTI ? C.UNO : platform
//     let path = ''

//     if (data_type === C.MATCHES) {
//         path = `\
//         crm/cod/v2/title/${game}/${C.PLATFORM}/${platform}/\
//         ${search_type}/${target}/${C.MATCHES}/${mode}/\
//         start/0/end/${start_time}000/details`
//     } else if (data_type === C.FULLMATCHES) {
//         path = `\
//         crm/cod/v2/title/${game}/${C.PLATFORM}/${platform}/\
//         fullMatch/${mode}/${target}/it/`
//     } else if (data_type === C.STATS) {
//         path = `\
//         ${data_type}/cod/v1/title/${game}/${C.PLATFORM}/${platform}/\
//         ${search_type}/${target}/profile/type/${mode}`
//     } else if (data_type === C.SEARCH) {
//         path = `\
//         crm/cod/v2/${C.PLATFORM}/${platform}/\
//         ${C.USERNAME}/${target}/${data_type}`
//     }

//     return `https://my.callofduty.com/api/papi-client/${path}`
// }

export const get_file_path = (
    player_tag: string,
    data_type: C.MATCHES | C.STATS,
    platform: PlatformOnly,
    game_mode: GameModeOnly,
    start_time = 0
) => {
    let path = ''
    if (data_type === C.STATS) {
        path = game_mode
    } else {
        path = `${game_mode}/${start_time}`
    }
    return `../${C.STATIC}/${C.FILES}/${C.DATA}/${data_type}/${platform}/${player_tag}/${path}.json`
}
