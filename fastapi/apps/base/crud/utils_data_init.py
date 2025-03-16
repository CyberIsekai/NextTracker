from apps.base.schemas.main import C, LogsSourceOnly
from apps.base.crud.store_tables import SBT

from apps.tracker.crud.store_tables import STT

LOGS_TABLES: dict[LogsSourceOnly, object] = {
    # LogsBasic
    C.LOGS: SBT.logs,
    'logs_user': SBT.logs_user,
    'logs_error': SBT.logs_error,
    'cod_logs': STT.cod_logs,
    'cod_logs_player': STT.cod_logs_player,
    'cod_logs_error': STT.cod_logs_error,
    'logs_url': SBT.logs_url,
    'logs_ip': SBT.logs_ip,
    # LogsRequests
    'logs_request': SBT.logs_request,
    'logs_request_error': SBT.logs_request_error,
    'logs_request_auth': SBT.logs_request_auth,
    # other
    'cod_logs_search': STT.cod_logs_search,
    'cod_logs_task_queues': STT.cod_logs_task_queues,
}
