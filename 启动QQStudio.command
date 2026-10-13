#!/usr/bin/env bash
cd "$(dirname "$0")"
bash ./start-qq-studio.sh "$@"
status=$?
if [ "$status" -ne 0 ]; then read -r -p '启动失败，请查看上面的提示。按回车关闭。'; fi
exit "$status"
