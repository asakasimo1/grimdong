#!/bin/bash
# ═══════════════════════════════════════════════
#  아이담(Aiddam) 프로젝트 — 새 PC 환경 셋업 스크립트
#  실행: bash setup.sh
# ═══════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "🎨 아이담 프로젝트 환경 설정을 시작합니다..."
echo ""

# ── 1. git 글로벌 설정 ──────────────────────────
echo "${YELLOW}[1/6] git 사용자 설정${NC}"
git config --global user.name "asakasimo1"
git config --global user.email "asakasimo1@users.noreply.github.com"
git config --global credential.helper osxkeychain
git config --global pull.rebase false
echo "${GREEN}✅ git 설정 완료${NC}"

# ── 2. git hooks 연결 ───────────────────────────
echo "${YELLOW}[2/6] git hooks 설정 (.githooks → 자동 push/pull)${NC}"
git config core.hooksPath .githooks
chmod +x .githooks/post-commit .githooks/post-merge
echo "${GREEN}✅ hooks 연결 완료${NC}"

# ── 3. app 브랜치 확인 ──────────────────────────
echo "${YELLOW}[3/6] app 브랜치 확인${NC}"
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "app" ]; then
  git checkout -b app --track origin/app 2>/dev/null || git checkout app
fi
echo "${GREEN}✅ 현재 브랜치: $(git branch --show-current)${NC}"

# ── 4. 최신 코드 pull ───────────────────────────
echo "${YELLOW}[4/6] 최신 코드 동기화 (pull)${NC}"
git pull origin app
echo "${GREEN}✅ 최신 상태로 업데이트 완료${NC}"

# ── 5. Doppler CLI 설치 및 설정 ─────────────────
echo "${YELLOW}[5/6] Doppler 시크릿 매니저 설정${NC}"

# Doppler 설치 여부 확인
if ! command -v doppler &>/dev/null; then
  echo "  Doppler 설치 중..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    DOPPLER_ARCH="arm64"
  else
    DOPPLER_ARCH="amd64"
  fi
  DOPPLER_VER=$(curl -s https://api.github.com/repos/DopplerHQ/cli/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  mkdir -p "$HOME/.local/bin"
  curl -sL "https://github.com/DopplerHQ/cli/releases/download/${DOPPLER_VER}/doppler_${DOPPLER_VER}_macOS_${DOPPLER_ARCH}.tar.gz" -o /tmp/doppler.tar.gz
  tar xzf /tmp/doppler.tar.gz -C /tmp/ doppler
  mv /tmp/doppler "$HOME/.local/bin/doppler"
  chmod +x "$HOME/.local/bin/doppler"

  # PATH 등록
  SHELL_RC="$HOME/.zshrc"
  [ -n "$BASH_VERSION" ] && SHELL_RC="$HOME/.bashrc"
  if ! grep -q 'local/bin' "$SHELL_RC" 2>/dev/null; then
    echo '\nexport PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  fi
  export PATH="$HOME/.local/bin:$PATH"
  echo "  ✅ Doppler v$(doppler --version 2>/dev/null | tr -d 'v') 설치 완료"
else
  echo "  Doppler 이미 설치됨 ($(doppler --version))"
fi

# Doppler 로그인 및 프로젝트 연결
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Doppler 로그인이 필요합니다."
echo "  브라우저가 열리면 로그인 후 승인해주세요."
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
doppler login
doppler setup --project aidam --config dev
echo "${GREEN}✅ Doppler 연결 완료${NC}"

# ── 6. npm install ──────────────────────────────
echo "${YELLOW}[6/6] 패키지 설치 (npm install)${NC}"
npm install
echo "${GREEN}✅ 패키지 설치 완료${NC}"

# ── 완료 안내 ────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "${GREEN}🎉 셋업 완료! 아래 명령어로 개발을 시작하세요:${NC}"
echo ""
echo "  doppler run -- npm run dev"
echo ""
echo "📌 작업 후 커밋하면 자동으로 GitHub에 push됩니다."
echo "   git add ."
echo "   git commit -m '작업 내용'"
echo "══════════════════════════════════════════"
echo ""
