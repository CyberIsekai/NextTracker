# pylint: disable=redefined-outer-name
import signal
import sys
import socket
import time
import threading
import traceback

from core.config import settings
from core.database import get_db

from apps.base.schemas.main import C, STask
from apps.base.crud.utils import (
    get_message_response,
    now,
    redis_manage,
    users_cache_set,
    get_status,
)

from apps.tracker.schemas.main import ResetType, SocketBody, Task
from apps.tracker.crud.main import get_data_from_platforms, reset, task_start
from apps.tracker.crud.utils import (
    add_to_task_queues,
    player_get,
    players_cache_update,
    in_logs_queues,
)


class Monitor:
    def __init__(self):
        self.time: str = now(C.ISO)
        self.on: bool = True
        self.proccess: threading.Thread | None = None
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

        self.AUTO_UPDATE_INTERVAL = settings.AUTO_UPDATE_INTERVAL_DAYS.total_seconds()
        self.TASK_QUEUES_INTERVAL = (
            settings.TASK_QUEUES_INTERVAL_SECONDS.total_seconds()
        )


MONITOR = Monitor()


def shutdown_monitor(signum=0, frame=''):
    MONITOR.on = False
    time.sleep(MONITOR.TASK_QUEUES_INTERVAL)
    message = f'{C.MONITOR} was shutdown '

    try:
        message += f'[{signum}] \n{frame}'
        MONITOR.socket.close()
        if MONITOR.proccess:
            MONITOR.proccess.join()
    except Exception as e:
        message += f'\n{C.ERROR} [{e}] while shutdown'

    settings.LOGGING.warning(message)
    sys.exit()


def handle_client(client: socket.socket):
    while MONITOR.on:
        try:
            # Receive data from the client
            data: bytes = client.recv(1024)
            if not data:
                break

            # Decode and proceed the received message
            message = data.decode()

            if message == 'ping':
                client.send(b'pong')
                break

            if message == C.TIME:
                client.send(MONITOR.time.encode())
                break

            if message in ResetType.__args__:
                with next(get_db()) as db:
                    res = reset(db, message)
                    if isinstance(res, dict):
                        client.send(C.COMPLETED.encode())
                    else:
                        client.send(get_message_response(res).encode())
                break

            if message == 'stop':
                client.send(b'stopping')
                client.close()
                shutdown_monitor(0, message)
                return

            try:
                body = SocketBody.model_validate_json(message)
                name, value = body.name, body.value
                with next(get_db()) as db:
                    if name == 'player_game_mode_access':
                        if player := player_get(
                            db,
                            value[C.UNO],
                            C.BASIC,
                            f'{C.MONITOR} socket {name} {value[C.GAME_MODE]} {value[C.DATA_TYPE]}',
                        ):
                            res = get_data_from_platforms(
                                db,
                                player,
                                value[C.GAME_MODE],
                                value[C.DATA_TYPE],
                            )
                            res = '1' if res[C.DATA] else ''
                    client.send(res.encode())
                break

            except Exception as e:
                settings.LOGGING.error(f'{C.MONITOR} {message} [{e}]')
                client.send(b'received')

        except Exception as e:
            settings.LOGGING.error(f'{C.MONITOR} {handle_client.__name__} [{e}]')
            break

    client.close()


def monitor_tasks():
    count_time = 0

    while MONITOR.on:
        count_time += MONITOR.TASK_QUEUES_INTERVAL
        if count_time > MONITOR.AUTO_UPDATE_INTERVAL and get_status(C.AUTO_UPDATE):
            add_to_task_queues(C.ALL, C.ALL, C.ALL)
            count_time = 0

        task: Task | None = redis_manage(C.TASK_QUEUES, 'lindex')
        if task is None or task[C.STATUS] != STask.PENDING:
            time.sleep(MONITOR.TASK_QUEUES_INTERVAL)
            continue

        with next(get_db()) as db:
            task_start(db, task)


if __name__ == '__main__':
    # Add listen signals for properly shutdown monitor
    signal.signal(signal.SIGTERM, shutdown_monitor)
    signal.signal(signal.SIGINT, shutdown_monitor)

    try:
        MONITOR.socket.bind(
            (settings.FASTAPI_MONITOR_HOST, settings.FASTAPI_MONITOR_PORT)
        )
        MONITOR.socket.listen(settings.GUNICORN_WORKERS)
        settings.LOGGING.warning(
            f'{C.MONITOR} started, listen [{settings.GUNICORN_WORKERS}]'
        )
    except Exception as e:
        message = f'{C.MONITOR} start socket {C.ERROR} [{e}]'
        shutdown_monitor(1, message)

    # ==================== Set cache ====================
    # redis_manage('', 'flushall')

    with next(get_db()) as db:
        # Save deleted tasks in logs
        task_queues: list[Task] = redis_manage(C.TASK_QUEUES, 'lrange')
        for task in task_queues:
            task[C.STATUS] = STask.DELETED
            task[C.DATA][C.SOURCE] = C.MONITOR
            in_logs_queues(db, task)

        users_cache_set(db)
        players_cache_update(db)
    # ==================== Set cache ====================

    MONITOR.proccess = threading.Thread(target=monitor_tasks)
    MONITOR.proccess.start()

    settings.LOGGING.warning(f'{C.MONITOR} started')

    redis_manage(C.STATUS, 'set', C.ACTIVE)

    while MONITOR.on:
        try:
            socket_client, socket_address = MONITOR.socket.accept()
            # Create a new thread to handle the client
            client_thread = threading.Thread(
                target=handle_client, args=(socket_client,)
            )
            client_thread.start()
        except KeyboardInterrupt:
            shutdown_monitor(0, f'[{e}]')
        except OSError as e:
            shutdown_monitor(e.errno, f'[{e}]')
        except Exception as e:
            shutdown_monitor(1, f'{traceback.format_exc()}\n{e}')
