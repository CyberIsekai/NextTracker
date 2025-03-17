#!/bin/bash

ACTION="$1"
ACTION_2="$2"
ACTION_3="$3"
CURRENT_DIRECTORY=$PWD

APP_NAME=NextTracker
NEXTJS_APP_NAME="$APP_NAME"_nextjs
FASTAPI_APP_NAME="$APP_NAME"_fastapi
NEXTJS_CONFIG=/etc/systemd/system/$NEXTJS_APP_NAME.service
FASTAPI_CONFIG=/etc/systemd/system/$FASTAPI_APP_NAME.service
FASTAPI_SOCK_FILE=runing.sock
FASTAPI_MONITOR_NAME=monitor.py

FASTAPI_API_PATH=/api/fastapi
NEXTJS_API_PATH=/api/nextjs

if grep -q "ID=manjaro" /etc/os-release; then
    IS_MANJARO=true
else
    IS_MANJARO=false
fi

if [ -d "/run/systemd/system" ]; then
    SERVICE_MANAGER="systemctl"
elif command -v service >/dev/null 2>&1; then
    SERVICE_MANAGER="service"
else
    SERVICE_MANAGER=unknown
fi

function color_echo {
    # Red: 31
    # Green: 32
    # Yellow: 33
    # Blue: 34
    # Magenta: 35
    local message="$1"
    local color_code="$2"
    echo -e "\e[${color_code}m===================================================\e[0m"
    echo -e "\e[${color_code}m${message}\e[0m"
    echo -e "\e[${color_code}m===================================================\e[0m"
}

function confirm() {
    local message="$1"
    echo -e "\e[34m$message\e[0m"

    while true; do
        read -p "Do you want to proceed? (YES/NO/CANCEL) " yn
        case $yn in
        [Yy]*) return 0 ;;
        [Nn]*) return 1 ;;
        [Cc]*) exit ;;
        *) echo "Please answer YES, NO, or CANCEL." ;;
        esac
    done
}

function manage_process() {
    local NAME="$1"
    local ACTION="$2"

    echo -e "\e[33m$SERVICE_MANAGER $ACTION $NAME\e[0m"

    if [[ "$SERVICE_MANAGER" = "systemctl" ]]; then
        sudo $SERVICE_MANAGER $ACTION $NAME
    elif [[ "$SERVICE_MANAGER" = "service" ]]; then
        sudo $SERVICE_MANAGER $NAME $ACTION
    fi
}

function is_running() {
    local NAME="$1"
    local MODE="$2"

    if [[ "$SERVICE_MANAGER" = "systemctl" ]]; then
        RESULT=$(systemctl is-active "$NAME")
    elif [[ "$SERVICE_MANAGER" = "service" ]]; then
        RESULT=$(service $NAME status)
        if [[ $RESULT == *"Active: active"* || $RESULT == *"$NAME is running"* || $RESULT == *"online"* ]]; then
            RESULT=active
        else
            RESULT=inactive
        fi
    else
        RESULT=unknown
    fi

    if [[ "$RESULT" = "active" ]]; then
        ! [[ "$MODE" = "silence" ]] && echo -e "$NAME \033[1;32m$RESULT\033[0m"
        return 0
    fi

    if [[ "$RESULT" = "activating" ]]; then
        ! [[ "$MODE" = "silence" ]] && echo -e "$NAME \033[1;33m$RESULT\033[0m"
        return 1
    fi

    ! [[ "$MODE" = "silence" ]] && echo -e "$NAME \033[1;31m$RESULT\033[0m"

    return 1
}

function rerun_script() {
    echo "$1" "$2"
    if [[ "$ACTION_3" == "close" ]]; then
        exit
    fi
    cd $CURRENT_DIRECTORY
    exec "$0" "$1" "$2"
}

if [[ "$ACTION" == "update" ]]; then
    git stash
    GIT_RESPONSE=$(git pull)
    chmod +x install.sh manage.sh
    if [[ $GIT_RESPONSE == "Already up to date." ]]; then
        color_echo "Actual version" "32"
    else
        if [ -f .env ]; then
            (cd nextjs && npm run build && echo)
        fi
        source fastapi/.venv/bin/activate
        pip install -r fastapi/requirements.txt --upgrade
    fi
    rerun_script
fi

if [ -f .env ]; then
    # Load variables from .env file
    while read line; do export $line >/dev/null 2>&1; done <.env

    color_echo "Tracker [$DATABASE_USER] [$ADMIN_LOGIN]" "32"
    is_running "$NEXTJS_APP_NAME"
    # is_running "$FASTAPI_APP_NAME" && curl -s "http://$STATIC_IP/api/fastapi/check_alive" && echo
    is_running "$FASTAPI_APP_NAME" &&
        curl --unix-socket fastapi/$FASTAPI_SOCK_FILE \
            $STATIC_IP/api/fastapi/check_alive && echo
    echo "$FASTAPI_MONITOR_NAME [$(pgrep -f $FASTAPI_MONITOR_NAME)]"
    is_running "nginx"
    is_running "postgresql"
    is_running "redis"
    echo -e "Address: \033[1;35mhttp://${STATIC_IP_2:-$STATIC_IP}/\033[0m"
    echo

    ACTIONS=(
        "nextjs"
        "fastapi"

        "start"
        "stop"
        "restart"
        "enable"
        "disable"

        "backup_tables"
        "update"
        "delete"
    )

    # Check if ACTION argument was passed else choose
    if [ -z "$ACTION" ]; then
        PS3="Select action: "
        select ACTION in "${ACTIONS[@]}"; do
            break
        done
    fi

    # Check if the ACTION is not in the array of ACTIONS
    if [[ ! " ${ACTIONS[@]} " =~ " ${ACTION} " ]]; then
        color_echo "Invalid action: $ACTION" "31"
        rerun_script
    fi

    color_echo "Choosen action: \033[1;35m$ACTION $ACTION_2 $ACTION_3\033[0m" "33"

    if [[ "$ACTION" == "update" ]]; then
        rerun_script "update"
    fi

    if [[ "$ACTION" == "start" ]]; then
        ! is_running "nginx" && manage_process "nginx" "start"
        ! is_running "postgresql" && manage_process "postgresql" "start"
        ! is_running "redis" && manage_process "redis" "start"
    fi

    if [[ "$ACTION" == "restart" ]]; then
        manage_process "nginx" "restart"
        manage_process "postgresql" "restart"
        manage_process "redis" "restart"
    fi

    case "$ACTION" in "start" | "stop" | "restart" | "enable" | "disable")
        manage_process "$NEXTJS_APP_NAME" "$ACTION"
        manage_process "$FASTAPI_APP_NAME" "$ACTION"
        rerun_script
        ;;
    esac

    if [[ "$ACTION" == "nextjs" ]]; then
        is_running "$NEXTJS_APP_NAME"

        ACTIONS_2=(
            "dev"
            "rebuild_restart"
            "status"
            "start"
            "stop"
            "restart"
            "back"
        )
        if [ -z "$ACTION_2" ]; then
            PS3="Select $ACTION action: "
            select ACTION_2 in "${ACTIONS_2[@]}"; do
                break
            done
        fi

        if [[ "$ACTION_2" == "back" ]]; then
            rerun_script
        fi

        cd nextjs

        if [[ "$ACTION_2" == "dev" ]]; then
            is_running "$NEXTJS_APP_NAME" && manage_process "$NEXTJS_APP_NAME" "stop"
            npm run $ACTION_2
        elif [[ "$ACTION_2" == "rebuild_restart" ]]; then
            npm run build
            echo
            manage_process "$NEXTJS_APP_NAME" restart
        else
            manage_process "$NEXTJS_APP_NAME" "$ACTION_2"
        fi

        rerun_script "nextjs"
    fi

    if [[ "$ACTION" == "fastapi" ]]; then
        is_running "$FASTAPI_APP_NAME"

        ACTIONS_2=(
            "uvicorn"
            "uvicorn $FASTAPI_PORT port"
            "gunicorn $GUNICORN_WORKERS workers"
            "monitor dev"
            "start"
            "stop"
            "restart"
            "status"
            "update tables"
            "run tests"
            "back"
        )
        if [ -z "$ACTION_2" ]; then
            PS3="Select $ACTION action: "
            select ACTION_2 in "${ACTIONS_2[@]}"; do
                break
            done
        fi

        if [[ "$ACTION_2" == "back" ]]; then
            rerun_script
        fi

        cd fastapi
        source .venv/bin/activate
        export PYTHONPATH=$PWD

        if [[ "$ACTION_2" == "uvicorn" || "$ACTION_2" == "gunicorn $GUNICORN_WORKERS workers" ]]; then
            if is_running "$FASTAPI_APP_NAME" "silence"; then
                if confirm "Stop running $FASTAPI_APP_NAME ?"; then
                    manage_process "$FASTAPI_APP_NAME" "stop"
                    sleep 1
                else
                    deactivate
                    rerun_script "fastapi"
                fi
            fi
            [ -S $FASTAPI_SOCK_FILE ] && rm $FASTAPI_SOCK_FILE
        fi

        if [[ "$ACTION_2" == "uvicorn" ]]; then
            exec uvicorn --reload --log-level debug --uds $FASTAPI_SOCK_FILE "main:app"

        elif [[ "$ACTION_2" == "uvicorn $FASTAPI_PORT port" ]]; then
            exec uvicorn --reload --log-level debug --host $FASTAPI_HOST --port $FASTAPI_PORT "main:app"

        elif [[ "$ACTION_2" == "gunicorn $GUNICORN_WORKERS workers" ]]; then
            exec gunicorn \
                --reload \
                --workers=$GUNICORN_WORKERS \
                --worker-class=uvicorn.workers.UvicornWorker \
                --log-level debug \
                --bind=unix:$FASTAPI_SOCK_FILE \
                "main:app"

        elif [[ "$ACTION_2" == "monitor dev" ]]; then
            echo "dev monitor started"
            python3 $FASTAPI_MONITOR_NAME

        elif [[ "$ACTION_2" == "update tables" ]]; then
            alembic upgrade head
            alembic revision --autogenerate
            read -p "Press Enter to confirm"
            alembic upgrade head

        elif [[ "$ACTION_2" == "run tests" ]]; then
            monitor_pid=$(pgrep -f $FASTAPI_MONITOR_NAME)

            if [ -z "$monitor_pid" ]; then
                python3 $FASTAPI_MONITOR_NAME &
                monitor_pid=$!
                color_echo "$FASTAPI_MONITOR_NAME [$monitor_pid] started" "33"
                is_started=true
            else
                color_echo "$FASTAPI_MONITOR_NAME [$monitor_pid] found" "33"
                is_started=false
            fi

            pytest -vs apps/base/tests/run_tests.py

            if [[ "$is_started" == true ]]; then
                if [ -n "$monitor_pid" ]; then
                    # kill -SIGTERM $monitor_pid
                    kill -9 $monitor_pid
                    echo "started $FASTAPI_MONITOR_NAME [$monitor_pid] stoped"
                fi
            fi

        else
            manage_process "$FASTAPI_APP_NAME" "$ACTION_2"
        fi

        deactivate
        rerun_script "fastapi"
    fi

    if [[ "$ACTION" == "backup_tables" ]]; then
        BACKUP_DIRECTORY="static/files/dumps/$(date +'%d_%m_%y')"
        if ! [ -d $BACKUP_DIRECTORY ]; then
            mkdir -p "$BACKUP_DIRECTORY"
            color_echo "Folder created: $BACKUP_DIRECTORY" "33"
        fi

        # TODO dump to csv file
        # sql_command="\COPY (SELECT * FROM $table) TO '$BACKUP_DIRECTORY/$table.csv' WITH CSV HEADER;"
        # sudo -u postgres psql -d $DATABASE_NAME -c "$sql_command"

        backup_tables() {
            local name="$1"
            local filter_by="$2"

            local backup_file="$BACKUP_DIRECTORY/$name.sql.gz"
            local name_label=$(echo "$name" | sed 's/_/ /g')

            # Check if the backup file already exists
            if test -f "$backup_file"; then
                color_echo "$name_label already saved here $backup_file" "33"
                return 1
            fi

            # Get a list of table names that match the criteria
            local sql="SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            local tablelist=$(sudo -u postgres psql -qAt -c "$sql AND $filter_by;" $DATABASE_NAME)

            # Loop through the tablelist and add the '-t' option for each table name
            local tableopts=""
            for table in $tablelist; do
                tableopts="$tableopts -t $table"
            done

            local print_tables=""
            for table in $tablelist; do
                print_tables="$print_tables\n$table"
            done
            color_echo "$print_tables" "35"

            while true; do
                read -p "[$name_label] Save these tables? (YES/NO/CANCEL) " yn
                case $yn in
                [Yy]*)
                    sudo -u postgres pg_dump $tableopts $DATABASE_NAME | gzip -9 >$backup_file
                    color_echo "Backup $name_label saved to $backup_file" "32"
                    break
                    ;;
                [Nn]*)
                    color_echo "Backup $name_label skipped" "33"
                    break
                    ;;
                *) echo "Please answer yes(y) or no(n)" ;;
                esac
            done
        }

        # Call the function for each set of tables
        backup_tables non_matches "tablename NOT LIKE '%matches%'"
        backup_tables matches "tablename LIKE '%cod_matches%'"
        backup_tables main_fullmatches "tablename LIKE '%fullmatches%' AND tablename NOT LIKE '%basic%'"
        backup_tables store_fullmatches "tablename LIKE '%cod_fullmatches_basic%'"

        rerun_script
    fi

    if [[ "$ACTION" == "delete" ]]; then

        if ! confirm "confirm delete"; then
            rerun_script
        fi

        manage_process $NEXTJS_APP_NAME "stop"
        manage_process $FASTAPI_APP_NAME "stop"
        manage_process $NEXTJS_APP_NAME "disable"
        manage_process $FASTAPI_APP_NAME "disable"

        sudo rm $NEXTJS_CONFIG
        sudo rm $FASTAPI_CONFIG
        color_echo "deleted $NEXTJS_CONFIG" "33"
        color_echo "deleted $FASTAPI_CONFIG" "33"

        if [[ "$SERVICE_MANAGER" = "systemctl" ]]; then
            sudo systemctl daemon-reload
        elif [[ "$SERVICE_MANAGER" = "service" ]]; then
            sudo update-rc.d -f $NEXTJS_APP_NAME remove
            sudo update-rc.d -f $FASTAPI_APP_NAME remove
        fi

        monitor_pid=$(pgrep -f $FASTAPI_MONITOR_NAME)
        if [ -n "$monitor_pid" ]; then
            # kill -SIGTERM $monitor_pid
            kill -9 $monitor_pid
            echo "started $FASTAPI_MONITOR_NAME [$monitor_pid] stoped"
        fi

        redis-cli flushall
        manage_process "postgresql" "restart"

        if confirm "Delete database $DATABASE_NAME ?"; then
            sudo -u postgres psql -c "DROP DATABASE $DATABASE_NAME;"

            ALEMBIC_DIRECTORY=fastapi/alembic/versions
            ALEMBIC_DIRECTORY_BACKUP=$ALEMBIC_DIRECTORY.back/$(date +'%d_%m_%y')

            mv $ALEMBIC_DIRECTORY $ALEMBIC_DIRECTORY_BACKUP
            mkdir $ALEMBIC_DIRECTORY

            cp $ALEMBIC_DIRECTORY_BACKUP/__init__.py $ALEMBIC_DIRECTORY/__init__.py
            cp $ALEMBIC_DIRECTORY_BACKUP/README.md $ALEMBIC_DIRECTORY/README.md

            color_echo "alembic versions saved to $ALEMBIC_DIRECTORY_BACKUP" "33"
        fi

        if confirm "Delete role $DATABASE_USER ?"; then
            sudo -u postgres psql -c "DROP ROLE $DATABASE_USER;"
        fi

        find logs -type f -name "*.log" -exec rm {} +
        rm .env

        if [ -f "$SAVED_NGINX_CONFIG" ]; then
            color_echo "restore saved nginx config - $SAVED_NGINX_CONFIG" "33"
            sudo rm /etc/nginx/nginx.conf
            sudo mv "$SAVED_NGINX_CONFIG" /etc/nginx/nginx.conf
            sudo nginx -t
            manage_process "nginx" "restart"
        fi

        color_echo "$ACTION finish" "33"
        rerun_script
    fi

    exit
fi

! confirm "Setup $APP_NAME ?" && exit

color_echo "Setup $APP_NAME started" "32"

# if confirm "Update repositories ?"; then
#     if [[ "$IS_MANJARO" == true ]]; then
#         sudo pacman -Syu
#     else
#         sudo apt-get update
#     fi
# fi
# echo

[ ! -d "logs" ] && mkdir "logs"

# Retrieve IPv4 addresses assigned to global scope
ipv4_addresses=($(ip -o -4 addr show scope global | awk '{split($4,a,"/"); print a[1]}'))
STATIC_IP=localhost
STATIC_IP_2="${ipv4_addresses[0]}"
STATIC_IP_3="${ipv4_addresses[1]}"

PHYSICAL_CORES=$(lscpu | grep 'Core(s) per socket' | awk '{print $NF}')

if [ -f "fastapi/.venv/bin/activate" ]; then
    source fastapi/.venv/bin/activate
elif confirm "Install python-venv with packages: \n$(cat fastapi/requirements.txt)"; then

    # if [[ "$IS_MANJARO" == true ]]; then
    #     sudo pacman -S python -y
    # else
    #     # sudo add-apt-repository -y ppa:deadsnakes/ppa
    #     sudo apt-get install python3 python3-venv -y
    # fi

    color_echo "Create and activate python venv" "33"
    python3 -m venv fastapi/.venv
    source fastapi/.venv/bin/activate

    color_echo "Start install requirements" "33"
    pip install --upgrade pip
    pip install -r fastapi/requirements.txt --upgrade
else
    color_echo "Install fastapi requirements and activate python venv skipped" "31"
fi
echo

# Check if redis not installed and ask for install
if ! which redis-server >/dev/null && confirm "Install redis ?"; then
    if [[ "$IS_MANJARO" == true ]]; then
        sudo pacman -S redis -y
    else
        [ -n "$REPOSITORY" ] && sudo add-apt-repository -y "$REPOSITORY"
        sudo apt-get install redis -y
    fi
    sudo systemctl daemon-reload
    if confirm "Enable system startup for redis ?"; then
        manage_process "redis" "enable"
    fi
fi
! pgrep "redis" >/dev/null && manage_process "redis" "start"

# Check if PostgreSQL not installed and ask for install
if ! command -v psql >/dev/null 2>&1 && confirm "Install PostgreSQL?"; then
    if [[ "$IS_MANJARO" == true ]]; then
        sudo pacman -S postgresql
    else
        sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list'
        sudo wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
        sudo apt-get install postgresql -y
    fi

    color_echo "Setting password for postgres..." "33"
    sudo passwd postgres
    su -l postgres -c "initdb --locale=C.UTF-8 --encoding=UTF8 -D '/var/lib/postgres/data'"

    if confirm "Enable system startup for postgresql ?"; then
        manage_process "postgresql" "enable"
    fi
fi
echo

# Check if PostgreSQL installed using pg_config
if ! type "pg_config" >/dev/null; then
    color_echo "PostgreSQL not found" "31"
else
    # Get the PostgreSQL version number
    PG_VERSION=$(echo $(pg_config --version 2>&1) | cut -d ' ' -f 2 | cut -d '.' -f 1)
    color_echo "PostgreSQL version: $PG_VERSION" "33"
    # If PostgreSQL is not active, start it
    ! pgrep "postgres" >/dev/null && manage_process "postgresql" "start"
fi

if confirm "Setup settings ? Active PostgreSQL required"; then
    read -e -p "Database server address: " -i "localhost" DATABASE_HOST
    read -e -p "Database user: " -i "tracker_user" DATABASE_USER
    read -s -p "Database password (leave empty for auto-generated): " DATABASE_PASSWORD
    echo
    if [[ -z "$DATABASE_PASSWORD" ]]; then
        # If the password is empty, generate a random password
        DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 12)
        color_echo "Generated Database password: $DATABASE_PASSWORD" "35"
    fi
    read -e -p "Database name: " -i "tracker_base" DATABASE_NAME
    echo

    color_echo "Creating tracker user with admin role" "33"
    read -e -p "Admin login: " -i "tracker_admin" ADMIN_LOGIN
    read -e -p "Admin email: " -i "admin@tracker.com" ADMIN_EMAIL
    read -s -p "Admin password (leave empty for auto-generate): " ADMIN_PASSWORD
    echo
    if [[ -z "$ADMIN_PASSWORD" ]]; then
        # If the password is empty, generate a random password
        ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 12)
        color_echo "Generated admin password: $ADMIN_PASSWORD" "35"
    fi
    echo

    cat >.env <<EOL
APP_NAME=$APP_NAME
NEXTJS_APP_NAME=$NEXTJS_APP_NAME
FASTAPI_APP_NAME=$FASTAPI_APP_NAME

STATIC_IP=$STATIC_IP # fastapi endpoint
STATIC_IP_2=$STATIC_IP_2 # nextjs endpoint (if empty will be used 'STATIC_IP')
STATIC_IP_3=$STATIC_IP_3 # Extra nextjs endpoint

# auth cookie for recieve player matches history
ACT_SSO_COOKIE=

DATABASE_HOST=$DATABASE_HOST
DATABASE_PORT=5432
DATABASE_NAME=$DATABASE_NAME
DATABASE_USER=$DATABASE_USER
DATABASE_PASSWORD=$DATABASE_PASSWORD

ADMIN_LOGIN=$ADMIN_LOGIN
ADMIN_PASSWORD=$ADMIN_PASSWORD

GUNICORN_WORKERS=$PHYSICAL_CORES

NEXTJS_PORT=3000

FASTAPI_API_PATH=$FASTAPI_API_PATH
NEXTJS_API_PATH=$NEXTJS_API_PATH

FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
FASTAPI_SOCK_FILE=$FASTAPI_SOCK_FILE

FASTAPI_MONITOR_NAME=$FASTAPI_MONITOR_NAME
FASTAPI_MONITOR_HOST=127.0.0.1
FASTAPI_MONITOR_PORT=8001

TEST_GROUP=test_group

TOKEN_EXPIRE=30
MATCHES_INTERVAL=15
STATS_INTERVAL=1
TASK_QUEUES_INTERVAL=5
AUTO_UPDATE_INTERVAL=1

NAME_LIMIT=40
NAME_LIMIT_2=100

PASSWORD_LENGTH_REQUIRED=8
PASSWORD_LENGTH_LIMIT=100

LOGIN_LENGTH_REQUIRED=3
LOGIN_LENGTH_LIMIT=30

GROUP_NAME_LENGTH_REQUIRED=2
GROUP_NAME_LENGTH_LIMIT=12

PARS_PRE_LIMIT=800
MATCHES_LIMIT=20
PAGE_LIMIT=20

LOGS_CACHE_LIMIT=40
LOGS_GAMES_LIMIT=20
EOL

    sudo bash -c "cat > /etc/sudoers.d/$APP_NAME << EOL
$USER ALL=(ALL) NOPASSWD: /usr/bin/psql
$USER ALL=(ALL) NOPASSWD: \
/bin/systemctl start $NEXTJS_APP_NAME, \
/bin/systemctl stop $NEXTJS_APP_NAME, \
/bin/systemctl restart $NEXTJS_APP_NAME, \
/bin/systemctl status $NEXTJS_APP_NAME
$USER ALL=(ALL) NOPASSWD: \
/bin/systemctl start $FASTAPI_APP_NAME, \
/bin/systemctl stop $FASTAPI_APP_NAME, \
/bin/systemctl restart $FASTAPI_APP_NAME, \
/bin/systemctl status $FASTAPI_APP_NAME

EOL"
    sudo chmod 0440 /etc/sudoers.d/$APP_NAME
    sudo visudo -c
    color_echo "Allow $USER to run (psql, $APP_NAME) without sudo
    '/etc/sudoers.d/$APP_NAME' created" "33"

    DATABASE_EXIST=$(sudo -u postgres psql -lqt | grep "$DATABASE_NAME")
    if [[ -n "$DATABASE_EXIST" ]]; then
        color_echo "
        [$DATABASE_NAME] database already exist
        $DATABASE_EXIST
        make sure 'DATABASE_USER' and 'DATABASE_PASSWORD' set properly in '.env' file" "31"
    else
        color_echo "Create database [$DATABASE_NAME] and role [$DATABASE_USER]" "33"
        sudo -u postgres psql -c "CREATE DATABASE $DATABASE_NAME;"
        sudo -u postgres psql -c "CREATE USER $DATABASE_USER WITH PASSWORD '$DATABASE_PASSWORD';"
        sudo -u postgres psql -c "ALTER ROLE $DATABASE_USER SET client_encoding TO 'utf8';"
        sudo -u postgres psql -c "ALTER ROLE $DATABASE_USER SET default_transaction_isolation TO 'read committed';"
        sudo -u postgres psql -c "ALTER ROLE $DATABASE_USER SET timezone TO 'UTC';"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DATABASE_NAME TO $DATABASE_USER;"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DATABASE_USER;"
        sudo -u postgres psql -c "ALTER USER $DATABASE_USER WITH SUPERUSER;"

        color_echo "Run alembic first migration" "33"
        cd fastapi
        alembic upgrade head
        alembic revision --autogenerate -m 'first migration'
        alembic upgrade head
        cd ..
        color_echo "Tables created" "32"

        color_echo "Start import tables" "33"
        TRACKER_FOLDER=/home/"$APP_NAME"_tables

        # Check if directory exist and has tables
        if [ -d "$TRACKER_FOLDER" ] && [ -n "$(ls -A "$TRACKER_FOLDER" 2>/dev/null)" ]; then
            color_echo "Found folder $TRACKER_FOLDER with tables:" "33"
            sudo ls -A $TRACKER_FOLDER
        else
            sudo rm -rf "$TRACKER_FOLDER"
            sudo mkdir $TRACKER_FOLDER # create folder and copy csv tables dumps

            tables=$CURRENT_DIRECTORY/static/files/tables.zip
            color_echo "Start import $(sudo unzip -l "$tables")" "33"
            sudo unzip "$tables" -d "$TRACKER_FOLDER"

            tables_optional=$CURRENT_DIRECTORY/static/files/tables_optional.zip
            if test -f "$tables_optional" && confirm "
            Import these optional tables ? 
            $(sudo du -h "$tables_optional")
            $(sudo unzip -l "$tables_optional")
            This will take some time to unpack,
            then import into the database and required about 11 GB of free space"; then
                color_echo "Start import $tables_optional" "33"
                sudo unzip "$tables_optional" -d "$TRACKER_FOLDER"
            fi

        fi

        # give permission on folder to postgres user
        sudo chown -R postgres:postgres $TRACKER_FOLDER

        # import csv files to tables in database
        for table_file in $(
            ls $TRACKER_FOLDER
        ); do
            table_name=$(echo $table_file | cut -d '.' -f 1)
            sql_command="\COPY $table_name FROM '$TRACKER_FOLDER/$table_file' WITH CSV HEADER;"
            echo $sql_command
            sudo -u postgres psql -d "$DATABASE_NAME" -c "$sql_command"
            sudo -u postgres psql -d "$DATABASE_NAME" -c "SELECT setval('${table_name}_id_seq', (SELECT MAX(id) FROM \"$table_name\"));" > /dev/null
        done

        if confirm "Remove folder with tables $TRACKER_FOLDER ?"; then
            sudo rm -R "$TRACKER_FOLDER"
        fi

        ADMIN_PASSWORD_HASH=$(python3 -c "
import bcrypt

password = '$ADMIN_PASSWORD'
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
hashed = hashed.decode('utf8')
print(hashed)
        ")
        columns="(status, login, password, email, data, language, roles, time)"
        values="(0, '$ADMIN_LOGIN', '$ADMIN_PASSWORD_HASH', '$ADMIN_EMAIL', \
        '{}'::jsonb, 'en-US', '[\"user\", \"admin\"]'::json, CURRENT_TIMESTAMP)"
        sudo -u postgres psql -d $DATABASE_NAME -c "INSERT INTO users $columns VALUES $values;"
        color_echo "User [$ADMIN_LOGIN] was added as admin on tracker with given password" "32"
    fi

    if confirm "Allow outside connect to PostgreSQL ?"; then
        # Set the configuration file paths
        PG_CONF=/etc/postgresql/$PG_VERSION/main/postgresql.conf
        PG_HBA_CONF=/etc/postgresql/$PG_VERSION/main/pg_hba.conf

        ips=()
        for ip in $STATIC_IP $STATIC_IP_2 $STATIC_IP_3; do
            if [ -n "$ip" ] && [ "$ip" != "localhost" ]; then
                ips+=(", $ip")
            fi
        done
        CONFIG_LINE="listen_addresses = 'localhost${ips[*]}'"
        # CONFIG_LINE="listen_addresses = '*'"
        # Add the listen_addresses line to postgresql.conf
        echo "$CONFIG_LINE" | sudo tee -a $PG_CONF >/dev/null
        color_echo "$CONFIG_LINE added to $PG_CONF" "32"

        # Add the host line to pg_hba.conf
        read -p "Enter the address from which the connection will be: " REMOTE_HOST
        if [[ -n "$REMOTE_HOST" ]]; then
            echo "host    all     all     $REMOTE_HOST/32    scram-sha-256" | sudo tee -a $PG_HBA_CONF >/dev/null
            color_echo "REMOTE_HOST access $REMOTE_HOST added to $PG_HBA_CONF" "32"
        else
            color_echo "REMOTE_HOST was empy" "35"
        fi
        manage_process "postgresql" "restart"
    fi
else
    color_echo "Setup settings skipped" "35"
fi
echo

# Check if Nginx not installed and ask for install
if ! command -v nginx &>/dev/null && confirm "Install nginx ?"; then
    if [[ "$IS_MANJARO" == true ]]; then
        sudo pacman -S nginx -y
    else
        sudo add-apt-repository -y ppa:nginx/stable
        sudo apt-get install nginx -y
    fi
    if confirm "Enable system startup for nginx ?"; then
        manage_process "nginx" "enable"
    fi
fi

if confirm "Setup nginx config ?"; then
    NGINX_CONFIG=/etc/nginx/nginx.conf
    if [ -f "$NGINX_CONFIG" ]; then
        SAVED_NGINX_CONFIG="${NGINX_CONFIG}.$(date +'%d_%m_%y').bak"
        sudo mv "$NGINX_CONFIG" "$SAVED_NGINX_CONFIG"
        color_echo "$NGINX_CONFIG saved to $SAVED_NGINX_CONFIG" "33"
    fi

    sudo bash -c 'cat > '$NGINX_CONFIG' << EOL
user '$USER';

worker_processes  1;
events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;
    types_hash_max_size 4096;
    types_hash_bucket_size 128;

    server {
        listen 80 default_server;
        server_name '"${STATIC_IP_2:-$STATIC_IP}"';

        gzip on;
        gzip_disable "msie6";
        gzip_comp_level 6;
        gzip_min_length 1100;
        gzip_buffers 16 8k;
        gzip_proxied any;
        gzip_types
            text/plain
            text/css
            text/js
            text/xml
            text/javascript
            application/javascript
            application/x-javascript
            application/json
            application/xml
            application/rss+xml
            image/svg+xml/javascript;

        server_tokens off;
        proxy_hide_header X-Powered-By;
        client_max_body_size 20M;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;

            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection '"'upgrade'"';

            access_log '"$CURRENT_DIRECTORY"'/logs/nginx_nextjs.log;
        }

        location '"$FASTAPI_API_PATH"' {
            add_header Cache-Control "max-age=1,immutable, public, no-transform";
            add_header X-Content-Type-Options "nosniff";
            access_log '"$CURRENT_DIRECTORY"'/logs/nginx_fastapi.log;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection '"'upgrade'"';
            proxy_redirect off;
            proxy_buffering off;
            proxy_pass http://unix:'"$CURRENT_DIRECTORY"'/fastapi/'"$FASTAPI_SOCK_FILE"';
            proxy_pass_request_headers on;
            default_type application/json;
            charset utf-8;
            source_charset utf-8;
            charset_types *;
            # expires 2s;
        }

        location /map {
            alias '"$CURRENT_DIRECTORY"'/static/map;
            add_header X-Content-Type-Options "nosniff";
            add_header Cache-Control "max-age=31636000,immutable, public, no-transform";
            default_type image/webp;
            access_log off;
        }
    }
}

EOL'
    color_echo "Nginx config added" "32"
    sudo nginx -t
    manage_process "nginx" "restart"
else
    color_echo "Add config to nginx skipped" "35"
fi
echo

if (! command -v node &>/dev/null || ! command -v npm &>/dev/null) && confirm "Install current Node.js and npm?"; then
    if [[ "$IS_MANJARO" == true ]]; then
        sudo pacman -S nodejs npm
    else
        wget -q -O- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
        source ~/.bashrc
        nvm install node
    fi
fi
echo

NODE_PATH=$(which node | sed 's/\/node$//')

color_echo "Add nextjs as service $NEXTJS_CONFIG" "32"
sudo bash -c "cat > $NEXTJS_CONFIG << EOL
[Unit]
Description=Nextjs
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$CURRENT_DIRECTORY/nextjs
Environment=PATH=$NODE_PATH:/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production
ExecStart=$NODE_PATH/node $CURRENT_DIRECTORY/nextjs/node_modules/.bin/next start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$NEXTJS_APP_NAME

[Install]
WantedBy=multi-user.target

EOL"

color_echo "Add fastapi as service $FASTAPI_CONFIG" "32"
sudo bash -c "cat > $FASTAPI_CONFIG << EOL
[Unit]
Description=Gunicorn FastAPI
After=network.target

[Service]
User=$USER
Group=$USER
WorkingDirectory=$CURRENT_DIRECTORY/fastapi
ExecStart=$CURRENT_DIRECTORY/fastapi/.venv/bin/gunicorn \
    "main:app" \
    --name=$APP_NAME \
    --workers=$PHYSICAL_CORES \
    --worker-class=uvicorn.workers.UvicornWorker \
    --user=$USER \
    --group=$USER \
    --bind=unix:$CURRENT_DIRECTORY/fastapi/$FASTAPI_SOCK_FILE \
    --log-level=error \
    --log-file=-
ExecStartPre=/bin/sleep 10
Restart=always
RestartSec=10
Environment=PATH=$CURRENT_DIRECTORY/fastapi/.venv/bin
Environment=PYTHONPATH=$CURRENT_DIRECTORY/fastapi

[Install]
WantedBy=multi-user.target

EOL"

if [[ "$SERVICE_MANAGER" = "systemctl" ]]; then
    sudo systemctl daemon-reload
elif [[ "$SERVICE_MANAGER" = "service" ]]; then
    sudo update-rc.d $NEXTJS_APP_NAME defaults
    sudo update-rc.d $FASTAPI_APP_NAME defaults
fi

if confirm "Build nextjs app (npm required) ?"; then
    cd nextjs
    # npm i sass dotenv postgres ioredis bcryptjs jsonwebtoken zod csv-parser
    # npm i --save-dev @types/bcryptjs @types/jsonwebtoken
    # npm i -D drizzle-kit
    # npm i --force drizzle-orm react-intersection-observer
    npm install
    npm run build
    cd ..
else
    color_echo "Build nextjs skipped" "35"
fi
echo

if confirm "Enable autorun in the system ?"; then
    manage_process "$NEXTJS_APP_NAME" "enable"
    manage_process "$FASTAPI_APP_NAME" "enable"
fi

color_echo "Setup finish.
Address: http://${STATIC_IP_2:-$STATIC_IP}/
" "32"

rerun_script "fastapi" "run tests"
