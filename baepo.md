# Discord Bot 배포 가이드 (Render & GCP VM)

본 프로젝트([vtbot](file:///Users/yjshin/projects/vtbot))를 **Render** 또는 **GCP VM (Compute Engine)** 환경에 배포하고 서비스하는 가이드입니다.

---

## 1. Render 배포 (Background Worker)

디스코드 봇은 외부 웹 요청을 받지 않는 백그라운드 프로세스이므로, Render의 **Background Worker** 타입으로 배포해야 합니다.

### 1.1. Render에서 배포 설정
1. [Render 대시보드](https://dashboard.render.com/)에서 **New +** > **Background Worker**를 선택합니다.
2. 본 프로젝트([vtbot](file:///Users/yjshin/projects/vtbot))의 GitHub 리포지토리를 연동합니다.
3. 세부 설정 입력:
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm run start`
4. **Environment Variables** 설정:
   * `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `HENRIK_API_KEY`
   * `DATABASE_PATH`: `/data/db.json` (데이터 유지를 위해 설정 권장)
5. **Disk 마운트**:
   * **Disks** 메뉴에서 디스크 생성 (Name: `vtbot-db-disk`, Mount Path: `/data`)

*자세한 원클릭 배포 설정은 [3. Blueprint (render.yaml) 배포]를 참고하세요.*

---

## 2. GCP VM 배포 (Node.js & PM2)

GCP VM(Compute Engine, Linux 기준 - Ubuntu/Debian 권장)을 사용하여 봇을 24시간 가동하고, 프로세스가 꺼지더라도 자동으로 재부팅되도록 **PM2**를 설정하는 방법입니다.

### 2.1. VM 초기 설정 및 패키지 설치
VM 인스턴스에 SSH로 접속한 뒤 아래 명령어를 실행하여 필수 패키지를 설치합니다.

```bash
# 1. 패키지 리스트 업데이트 및 Git 설치
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl

# 2. Node.js (버전 20 LTS) 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Node.js 설치 상태 확인
node -v
npm -v
```

### 2.2. 프로젝트 복제 및 패키지 설정
```bash
# 1. GitHub 저장소 클론
git clone https://github.com/officeshinyujun/vtbot.git
cd vtbot

# 2. 의존성 패키지 설치
npm install

# 3. 빌드 (TypeScript 컴파일)
npm run build
```

### 2.3. 환경 변수 구성
`.env` 파일을 작성하여 디스코드 API 자격 증명을 설정합니다.
```bash
# .env.example를 복사하여 .env 생성
cp .env.example .env

# nano 편집기로 .env 파일 수정
nano .env
```
*방향키로 이동하여 실제 디스코드 봇 토큰 및 ID 값을 적고, `Ctrl + O` (저장) -> `Enter` -> `Ctrl + X` (종료)로 빠져나옵니다.*

> [!NOTE]
> **GCP VM의 데이터베이스 저장 특징**:
> GCP VM 환경은 파일시스템이 영구 유지되므로, Render와 달리 디스크 볼륨 설정을 따로 하지 않아도 프로젝트 루트([/Users/yjshin/projects/vtbot](file:///Users/yjshin/projects/vtbot)) 안의 `db.json`에 안전하게 데이터가 누적 저장됩니다.

### 2.4. PM2를 활용한 무중단 가동 설정
세션이 끊겨도 봇이 실행 상태를 유지하고, 시스템이 리부팅될 때 자동으로 켜지도록 PM2 프로세스 매니저를 적용합니다.

```bash
# 1. PM2 글로벌 설치
sudo npm install -g pm2

# 2. 빌드 파일(dist/index.js)을 PM2 백그라운드로 실행
pm2 start dist/index.js --name "vtbot"

# 3. VM 서버 재부팅 시 자동 시작 설정
pm2 startup
```
* `pm2 startup`을 입력하면 터미널 화면에 `sudo env PATH=... pm2 startup systemd -u ...` 형식의 긴 명령어가 출력됩니다. **해당 출력줄을 복사해서 터미널에 그대로 실행**해 주어야 자동 실행 데몬에 등록됩니다.

```bash
# 4. 현재 가동 중인 PM2 프로세스 상태 저장
pm2 save
```

### 2.5. PM2 관리 명령어 모음
* **실시간 로그 모니터링**: `pm2 logs vtbot`
* **봇 상태 확인**: `pm2 status`
* **봇 재시작**: `pm2 restart vtbot`
* **봇 정지**: `pm2 stop vtbot`

---

## 3. Blueprint (`render.yaml`) 배포 (Render 전용)

Render에서 인프라 구성 관리를 코드 형태로 처리하려면 프로젝트 루트에 `render.yaml` 파일을 두고 아래 설정을 활용하여 배포하면 편리합니다.

```yaml
services:
  - type: worker
    name: vtbot-discord-bot
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
    disk:
      name: vtbot-db-disk
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: DISCORD_TOKEN
        sync: false
      - key: CLIENT_ID
        sync: false
      - key: GUILD_ID
        sync: false
      - key: HENRIK_API_KEY
        sync: false
      - key: DATABASE_PATH
        value: /data/db.json
```
