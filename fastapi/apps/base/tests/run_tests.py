# pylint: disable=unused-import, wrong-import-position

import time

from core.config import settings

from apps.base.schemas.main import C
from apps.base.crud.utils import redis_manage, get_status, manage_monitor

# wait until monitor will be ready
time_interval = int(settings.TASK_QUEUES_INTERVAL_SECONDS.total_seconds())
time.sleep(time_interval * 2)
time_passed = 0
tracker_status: bool = manage_monitor(C.STATUS)
print(f'\n{tracker_status=}')

if tracker_status is False:
    print('sending stop signal')
    manage_monitor('stop')

    while True:
        time.sleep(time_interval)
        tracker_status = manage_monitor(C.STATUS)
        if tracker_status:
            break

        time_passed += time_interval

        print(f'tests waiting {C.MONITOR} {time_passed=} {tracker_status=}')

        if time_passed > (time_interval * time_interval):
            print(f'trying to start {C.MONITOR} again')
            manage_monitor('start')
            time_passed = 0



from apps.base.tests.users import (
    f_users,
    test_user_register,
    test_user_login,
    put_user,
    test_user_settings,
    test_users_get,
    test_user_put,
)

from apps.base.tests.logs import (
    f_logs,
    test_logs_get,
    test_log_delete,
    test_logs_delete,
)

from apps.notes.tests.main import (
    f_note,
    f_notes_post,
    test_notes_get,
    test_notes_post,
    test_notes_put,
    test_notes_delete,
)

from apps.base.tests.main import test_panel_get

from apps.base.tests.images import test_images_get

from apps.base.tests.configs import (
    f_config,
    test_configs_get,
    test_configs_post,
    test_configs_put,
    test_configs_delete,
)

from apps.base.tests.translate import (
    f_word,
    test_translate_get,
    test_translate_post,
    test_translate_put,
    test_translate_delete,
)

from apps.base.tests.roles import (
    f_role,
    test_roles_get,
    test_roles_post,
    test_roles_put,
    test_roles_delete,
)

from apps.tracker.tests.main import (
    f_players,
    f_matches,
    f_label,
    test_player_search,
    test_player_add,
    test_player_add_game_mode,
    test_player_matches_history_pars,
    test_update_router,
    test_player_matches_stats_update,
    test_players_get,
    test_matches_router,
    test_match_get,
    test_match_stats_get,
    test_clear_fullmatches_doubles,
    test_player_clear_match_doubles,
    test_labels_get,
    test_labels_put,
    test_labels_post,
    test_reset,
    test_task_queues_delete,
    test_player_delete,
    test_labels_delete,
    test_labels_delete_all,
)

from apps.base.tests.users import test_user_delete
