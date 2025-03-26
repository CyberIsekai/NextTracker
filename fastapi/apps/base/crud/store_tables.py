from apps.base.models.main import (
    Users,
    users_role,
    notes,
    configs,
    translate,
    translate_stats,
    logs_ip,
    logs_url,
    logs_request,
    logs_request_error,
    logs_request_auth,
    logs,
    logs_user,
    logs_error,
)


class StoreBaseTables():
    '''Global store tables for tracker'''

    def __init__(self):
        self.users = Users
        self.users_role = users_role
        self.notes = notes
        self.configs = configs
        self.translate = translate
        self.translate_stats = translate_stats

        self.logs = logs
        self.logs_user = logs_user
        self.logs_error = logs_error

        self.logs_request = logs_request
        self.logs_request_error = logs_request_error
        self.logs_request_auth = logs_request_auth

        self.logs_ip = logs_ip
        self.logs_url = logs_url


SBT = StoreBaseTables()
