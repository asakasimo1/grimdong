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
echo "${YELLOW}[1/5] git 사용자 설정${NC}"
git config --global user.name "asakasimo1"
git config --global user.email "asakasimo1@users.noreply.github.com"
git config --global credential.helper osxkeychain   # macOS 키체인 인증 저장
git config --global pull.rebase false               # merge 방식 pull
echo "${GREEN}✅ git 설정 완료${NC}"

# ── 2. git hooks 연결 ───────────────────────────
echo "${YELLOW}[2/5] git hooks 설정 (.githooks → 자동 push/pull)${NC}"
git config core.hooksPath .githooks
chmod +x .githooks/post-commit .githooks/post-merge
echo "${GREEN}✅ hooks 연결 완료${NC}"

# ── 3. app 브랜치 확인 ──────────────────────────
echo "${YELLOW}[3/5] app 브랜치 확인${NC}"
CURRENT=$(git branch --show-current)
if [ "$CURRENT" != "app" ]; then
  git checkout -b app --track origin/app 2>/dev/null || git checkout app
fi
echo "${GREEN}✅ 현재 브랜치: $(git branch --show-current)${NC}"

# ── 4. 최신 코드 pull ───────────────────────────
echo "${YELLOW}[4/5] 최신 코드 동기화 (pull)${NC}"
git pull origin app
echo "${GREEN}✅ 최신 상태로 업데이트 완료${NC}"

# ── 5. npm install ──────────────────────────────
echo "${YELLOW}[5/5] 패키지 설치 (npm install)${NC}"
npm install
echo "${GREEN}✅ 패키지 설치 완료${NC}"

# ── 완료 안내 ────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "${GREEN}🎉 셋업 완료! 아래 명령어로 개발을 시작하세요:${NC}"
echo ""
echo "  npm run dev"
echo ""
echo "📌 작업 후 커밋하면 자동으로 GitHub에 push됩니다."
echo "   git add ."
echo "   git commit -m '작업 내용'"
echo "══════════════════════════════════════════"
echo ""
