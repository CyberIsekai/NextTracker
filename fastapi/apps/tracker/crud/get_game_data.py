import time
from pathlib import Path
import simplejson as json

from core.config import settings

from apps.base.schemas.main import C
from apps.base.crud.utils import (
    date_format,
    get_data,
    in_logs,
    in_logs_cod_logs_cache,
    redis_manage,
    get_status,
)

from apps.tracker.crud.store_game_modes import SGM
from apps.tracker.schemas.main import GameDataSlugs
from apps.tracker.crud.utils import make_break


class GameData:
    def __init__(self):
        pass

    @staticmethod
    def get_url(slugs: GameDataSlugs):
        '''
        # MATCHES
        uno/gamer/Stikinson%231007442' activision id \n
        uno/uno/18314460775731398053' uno \n
        battle/gamer/Stikinson%232924' battle tag \n

        # SEARCH
        uno/username/Stikinson%231007442/search' activision id \n
        uno/username/Stikinson/search' activision id and uno \n
        battle/username/Stikinson/search' battle tag
        '''

        target, game_mode, data_type, platform, start_time = slugs
        target = target.replace('#', '%23')
        game, mode = SGM.desctruct_game_mode(game_mode)

        if platform == C.BATTLE:
            search_type = 'gamer'
        elif platform == C.ACTI:
            search_type = 'gamer'
            platform = C.UNO
        elif platform == C.UNO:
            search_type = C.UNO
        else:
            return ''

        if data_type == C.MATCHES:
            path = f'''\
crm/cod/v2/title/{game}/{C.PLATFORM}/{platform}/\
{search_type}/{target}/{C.MATCHES}/{mode}/\
start/0/end/{start_time}000/details\
'''
        elif data_type == C.FULLMATCHES:
            path = f'''\
crm/cod/v2/title/{game}/{C.PLATFORM}/{platform}/\
fullMatch/{mode}/{target}/it/\
'''
        elif data_type == C.STATS:
            path = f'''\
{data_type}/cod/v1/title/{game}/{C.PLATFORM}/{platform}/\
{search_type}/{target}/profile/type/{mode}\
'''
        elif data_type == C.SEARCH:
            path = f'''\
crm/cod/v2/{C.PLATFORM}/{platform}/\
{C.USERNAME}/{target}/{data_type}\
'''
        else:
            path = ''

        return f'https://my.callofduty.com/api/papi-client/{path}'

    @staticmethod
    def generate_file_path(slugs: GameDataSlugs):
        target, game_mode, data_type, platform, start_time = slugs
        target = target.lower()
        directory = Path.cwd().parent / C.STATIC / C.FILES / C.DATA / data_type

        if data_type == C.MATCHES:
            directory = directory / platform / target / game_mode
            file_name = str(start_time)
        elif data_type == C.STATS:
            directory = directory / platform / target
            file_name = game_mode
        elif data_type == C.FULLMATCHES:
            directory /= game_mode
            file_name = target
        elif data_type == C.SEARCH:
            directory /= platform
            file_name = target
        else:
            return directory

        return directory / f'{file_name}.json'

    @staticmethod
    def get(
        slugs: GameDataSlugs,
        sleep: int,
        ignore_status=False,
    ) -> dict | list | None:
        if ignore_status is False and redis_manage(C.STATUS) != C.ACTIVE:
            return

        target, game_mode, data_type, platform, start_time = slugs
        player_username: str | None = (
            redis_manage(f'{C.PLAYER}:{C.UNO}_{target}', 'hget', C.USERNAME) or [None]
        )[0]
        username = player_username or target.split('#', maxsplit=1)[0]
        info = ' '.join((username, game_mode, data_type, platform))
        file_path = GameData.generate_file_path(slugs)

        is_have_token = settings.SESSION.cookies.get('ACT_SSO_COOKIE') is not None

        if is_have_token:
            time.sleep(sleep)
            data = get_data(GameData.get_url(slugs))
        else:
            data = get_data(file_path)


        message = f'[{data[C.TIME_TAKEN]}]'
        if start_time:
            message += f' [{date_format(start_time, C.DATETIME)}]'

        in_logs_cod_logs_cache(username, game_mode, message)
        game_data = data[C.DATA].get(C.DATA)

        if game_data and data[C.DATA].get(C.STATUS) == 'success':
            if is_have_token is False:
                if isinstance(data['url'], Path): # was loaded from local file
                    message += ' [local]'
                else: # save to local file
                    GameData.save_data(file_path, data[C.DATA])
            elif get_status('store_data'):
                GameData.save_data(file_path, data[C.DATA])

            if player_username:
                in_logs(target, f'{info} {message}', 'cod_logs_player')
            else:
                in_logs(info, message, 'cod_logs')

            return game_data

        message = data[C.DATA].get(C.MESSAGE, data[C.ERROR])
        if not message and game_data:
            message = game_data.get(C.MESSAGE)
        message = message or f'{C.GAME} {C.DATA} {C.NOT_FOUND}'

        file_path = Path.cwd().parent / C.STATIC / C.FILES
        file_path = file_path / C.ERROR / f'{message}.json'
        GameData.save_data(file_path, data[C.DATA])

        # data['url'] = str(data['url'])
        # if player_username:
        #     in_logs(target, f'{info} {message}', 'cod_logs_player', data)
        # else:
        #     in_logs(info, message, 'cod_logs_error', data)

        if message == 'Not permitted: not authenticated':
            break_minutes = None
        elif message == 'Not permitted: rate limit exceeded':
            break_minutes = 6
        elif message == C.NOT_FOUND:
            break_minutes = 2
        else:
            break_minutes = 0
        # elif message not in (
        #     'Not permitted: not allowed',
        #     'Not permitted: user not found',
        #     'Could not load data from datastore, full exception logged as error.'
        # ):...

        make_break(f'{target} {username}', game_mode, message, break_minutes)

    @staticmethod
    def save_data(file_path: Path, data: dict):
        if file_path.exists():
            return
        if file_path.parent.exists() is False:
            file_path.parent.mkdir()
        with open(file_path, 'w', encoding='utf8') as file:
            file.write(json.dumps(data))
