# Render를 이용한 Discord Bot 배포 가이드

본 프로젝트([vtbot](file:///Users/yjshin/projects/vtbot))를 [Render](https://render.com/)에 배포하는 가이드입니다. 디스코드 봇은 웹 요청을 받지 않는 지속 실행 프로세스이므로, Render의 **Background Worker (배경 작업 서비스)** 타입으로 배포해야 합니다.

---

## 1. 사전 준비 사항

### 1.1. Git 리포지토리 구성
Render는 GitHub 또는 GitLab 리포지토리와 연동하여 자동으로 빌드 및 배포를 수행합니다.
* 현재 코드가 Git 리포지토리에 푸시되어 있어야 합니다.

### 1.2. Render 계정 생성 및 연동
[Render 홈페이지](https://render.com/)에 가입하고, GitHub/GitLab 계정을 연동해 둡니다.

---

## 2. Render에서 배포 설정 단계

Render 대시보드([dashboard.render.com](https://dashboard.render.com/))에서 아래와 같이 새 서비스를 생성합니다.

### 2.1. 서비스 타입 선택
1. **New +** 버튼을 클릭한 뒤, **Background Worker**를 선택합니다.
   * *주의: **Web Service**를 선택하면 포트(Port) 바인딩 및 헬스 체크 실패로 인해 배포가 자동으로 중단됩니다.*
2. 연동된 Git 리포지토리 목록에서 본 프로젝트([vtbot](file:///Users/yjshin/projects/vtbot))를 선택합니다.

### 2.2. 인스턴스 세부 정보 설정
* **Name**: 서비스 이름 입력 (예: `vtbot-discord-bot`)
* **Region**: 사용자와 가까운 리전 선택 (예: `Singapore` 또는 `Oregon`)
* **Branch**: 배포할 브랜치 (예: `main` 또는 `master`)
* **Runtime**: `Node`
* **Build Command**: `npm install && npm run build`
* **Start Command**: `npm run start`

---

## 3. 환경 변수(Environment Variables) 설정

배포 생성 화면 하단의 **Advanced** 영역 혹은 생성 완료 후 **Variables** 메뉴에서 다음 환경 변수들을 등록합니다.

* `DISCORD_TOKEN`: 디스코드 봇 토큰
* `CLIENT_ID`: 디스코드 애플리케이션 ID
* `GUILD_ID`: 봇을 테스트할 디스코드 서버 ID
* `HENRIK_API_KEY`: Valorant API 호출을 위한 Henrik API 키
* `DATABASE_PATH`: 데이터베이스 파일이 위치할 절대 경로 (영구 데이터 유지를 위해 `/data/db.json`으로 설정을 권장합니다. 아래 **4. 로컬 데이터베이스 유지 설정** 참고)

---

## 4. 로컬 데이터베이스 (`db.json`) 유지 설정

이 봇은 유저 정보를 파일 데이터베이스에 기록하여 관리합니다 ([src/database.ts](file:///Users/yjshin/projects/vtbot/src/database.ts) 참조).

> [!WARNING]
> Render의 기본 파일시스템은 임시적(Ephemeral)이기 때문에, 봇이 재배포되거나 재시작되면 `db.json` 데이터가 삭제됩니다. 영구적인 데이터 저장을 위해 **Render Disk**와 `DATABASE_PATH` 환경 변수 설정을 완료해야 합니다.

### Render Disk 및 경로 설정 방법
1. 서비스 페이지의 **Disks** 메뉴로 이동하여 **Add Disk**를 클릭합니다.
2. 디스크 설정을 다음과 같이 입력합니다:
   * **Name**: `vtbot-db-disk`
   * **Mount Path**: `/data` (실행 폴더 외부의 독립된 영구 저장 공간)
   * **Size**: `1 GiB` (봇 데이터 용량 대비 매우 충분합니다)
3. 서비스의 **Variables** 메뉴에서 다음 환경 변수를 추가합니다:
   * **Key**: `DATABASE_PATH`
   * **Value**: `/data/db.json`
4. 코드([src/database.ts](file:///Users/yjshin/projects/vtbot/src/database.ts#L15))는 `DATABASE_PATH` 환경 변수가 있을 때 이 경로를 사용하도록 구성되어 있어, 로컬 개발 시에는 이전과 동일하게 프로젝트 루트의 `db.json`을 사용하고 Render 상에서는 마운트된 디스크의 `/data/db.json`을 안전하게 바라봅니다.

---

## 5. [선택] Blueprint (`render.yaml`)를 사용한 간편 배포

프로젝트 루트에 `render.yaml` 파일을 두면 클릭 한 번으로 모든 인프라 설정(디스크 및 환경 변수 구조)을 자동으로 구성하여 배포할 수 있습니다.

### 예시 `render.yaml` 구성
프로젝트 루트에 아래 설정으로 파일을 추가한 후 Git에 푸시하면 Render가 이를 감지하여 원클릭 배포 템플릿을 생성합니다.

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
* `sync: false` 옵션은 Render 대시보드에서 해당 값을 수동 입력하게 만듭니다.
* `DATABASE_PATH`는 자동으로 `/data/db.json`으로 바인딩되어 디스크 마운트 경로 `/data`와 매핑됩니다.

