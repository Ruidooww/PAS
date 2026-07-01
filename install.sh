#!/usr/bin/env bash
set -Eeuo pipefail

REGISTRY="registry.cn-hangzhou.aliyuncs.com"
DEFAULT_REF="main"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

if [[ -f "$SCRIPT_DIR/infra/docker-compose.prod.yml" ]]; then
  DEFAULT_INSTALL_DIR="$SCRIPT_DIR"
else
  DEFAULT_INSTALL_DIR="/opt/pas"
fi

INSTALL_DIR="${PAS_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
REF="${PAS_REF:-$DEFAULT_REF}"
RAW_BASE_URL="${PAS_RAW_BASE_URL:-https://raw.githubusercontent.com/Ruidooww/PAS/${REF}}"
ACR_USERNAME="${ACR_USERNAME:-}"
ACR_PASSWORD="${ACR_PASSWORD:-}"
SKIP_LOGIN=0
START_AFTER_PULL=0

usage() {
  cat <<'USAGE'
Usage:
  bash install.sh [options]

Options:
  --install-dir <path>      Install directory for compose files. Default: /opt/pas
  --ref <git-ref>           Git ref used when downloading compose files. Default: main
  --raw-base-url <url>      Override raw file base URL.
  --acr-username <name>     ACR username. Can also use ACR_USERNAME env.
  --acr-password <secret>   ACR password. Can also use ACR_PASSWORD env.
  --skip-login              Skip docker login and use existing Docker credentials.
  --up                      Run docker compose up -d after pulling images.
  -h, --help                Show help.

Examples:
  bash install.sh --acr-username '<ACR_USERNAME>'
  ACR_USERNAME='<ACR_USERNAME>' bash install.sh
  bash install.sh --skip-login --up
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --ref)
      REF="$2"
      RAW_BASE_URL="https://raw.githubusercontent.com/Ruidooww/PAS/${REF}"
      shift 2
      ;;
    --raw-base-url)
      RAW_BASE_URL="$2"
      shift 2
      ;;
    --acr-username)
      ACR_USERNAME="$2"
      shift 2
      ;;
    --acr-password)
      ACR_PASSWORD="$2"
      shift 2
      ;;
    --skip-login)
      SKIP_LOGIN=1
      shift
      ;;
    --up)
      START_AFTER_PULL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

download_file() {
  local source_url="$1"
  local target_path="$2"
  echo "Downloading ${source_url}"
  curl -fsSL "$source_url" -o "$target_path"
}

need_cmd curl
need_cmd docker
docker compose version >/dev/null

INFRA_DIR="${INSTALL_DIR}/infra"
COMPOSE_FILE="${INFRA_DIR}/docker-compose.prod.yml"
ENV_FILE="${INFRA_DIR}/.env.prod"
ENV_EXAMPLE_FILE="${INFRA_DIR}/.env.prod.example"

mkdir -p "$INFRA_DIR"

if [[ "$INSTALL_DIR" != "$SCRIPT_DIR" || ! -f "$COMPOSE_FILE" ]]; then
  download_file "${RAW_BASE_URL%/}/infra/docker-compose.prod.yml" "$COMPOSE_FILE"
  download_file "${RAW_BASE_URL%/}/infra/.env.prod.example" "$ENV_EXAMPLE_FILE"
elif [[ ! -f "$ENV_EXAMPLE_FILE" ]]; then
  download_file "${RAW_BASE_URL%/}/infra/.env.prod.example" "$ENV_EXAMPLE_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
  chmod 600 "$ENV_FILE" || true
  echo "Created ${ENV_FILE}. Edit it before starting production services."
fi

if [[ "$SKIP_LOGIN" -eq 0 ]]; then
  if [[ -n "$ACR_USERNAME" ]]; then
    if [[ -z "$ACR_PASSWORD" ]]; then
      read -rsp "ACR password: " ACR_PASSWORD
      echo
    fi
    printf '%s' "$ACR_PASSWORD" | docker login --username "$ACR_USERNAME" --password-stdin "$REGISTRY"
  else
    echo "No ACR username provided. Assuming Docker is already logged in to ${REGISTRY}."
  fi
fi

echo "Pulling all PAS production images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile migrate pull

if [[ "$START_AFTER_PULL" -eq 1 ]]; then
  echo "Starting PAS production services..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
fi

echo "Done."
