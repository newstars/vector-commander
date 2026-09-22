# Vector Commander

강전영 교수의 공개 공간 명시적 모기·감염병 ABM 연구를 기반으로 설계한
GIS 전략 게임 프로토타입입니다. 서울 25개 자치구를 전략 배경으로 두고,
실제 좌표와 2025년 승하차량을 적용한 주요 53개 지하철 역세권에 방역
자원을 배치합니다. 1주 단위 공간 시뮬레이션으로 모기 개체군, 승객 이동,
감염 위험 변화를 관찰합니다.

역 선택, 정책 편성, 예산과 방역팀 배분, 주간 시뮬레이션, 역세권 간 승객
흐름과 모기 확산 시각화를 하나의 턴제 흐름으로 구성했습니다.

> 모델 구조는 강전영 교수의 공개 논문을 기반으로 하지만, 논문의 원본
> 코드와 원본 파라미터를 직접 이식한 재현판은 아닙니다. 현재 계산은
> 투명한 샘플 어댑터이며 운영 또는 방역 의사결정에 사용하면 안 됩니다.

## 데모

![Vector Commander gameplay demo](docs/vector-commander-demo.gif)

방역팀 편성, 복수 역세권 선택, 역별 정책 배정, 1주 진행과 승객·모기
이동 경로 및 턴 결과 갱신까지의 실제 실행 화면입니다.

## 주요 기능

- 서울 25개 자치구 GeoJSON 경계 위 53개 주요 지하철 역세권 전술망
- 서울시 공개 데이터 기반 역 좌표와 2025년 일평균 승하차량
- 여러 역세권을 한 턴에 선택하는 동시 작전
- 역별로 서로 다른 방역 정책 배정
- 예산 기반 방역팀 편성과 자원 제약
- 정책 없이도 진행되는 1주 단위 턴
- 온도, 강수, 번식지, 유충, 성충, 감염 벡터를 반영한 주간 계산
- 노선 연결망을 따른 승객 흐름과 역세권 간 모기 확산 경로
- 실제 승하차량, 추정 생활인구, 감염 유입, 서식 압력, 노출 위험 지표
- 턴 직후 역별 증감 결과와 전술망 최대 변화 표시
- 교체 가능한 SimulationAdapter와 StationSimulationAdapter 인터페이스
- Docker, Docker Compose, Apple Container 실행 지원

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript |
| GIS | MapLibre GL, GeoJSON, SVG overlay |
| API | FastAPI, Pydantic |
| Simulation | Python spatial ABM-style sample adapter |
| Packaging | Docker, Docker Compose, Apple Container |
| Tests | pytest, ESLint, Next.js production build |

## 아키텍처

    Browser
      |
      +-- Next.js command UI
      |     +-- Seoul subway tactical map
      |     +-- station operation plans
      |     +-- passenger and mosquito flow layers
      |
      +-- FastAPI game API
            +-- Game Layer
            |     +-- budget and team rules
            |     +-- multi-station commands
            |     +-- weekly turns
            |
            +-- Simulation Core
                  +-- SimulationAdapter / StationSimulationAdapter
                  +-- district background and station catchments
                  +-- passenger flows and weekly state transitions

게임 규칙은 backend/app/simulation/game.py에, 모델 계산은
backend/app/simulation/adapters.py에 분리되어 있습니다. 검증된 외부
모델을 연결할 때는 두 어댑터 중 해당 경계를 구현하면 API와 프론트엔드를
유지할 수 있습니다.

## 빠른 실행

8080 포트는 사용하지 않습니다.

### Docker Compose

    docker compose up --build

### 단일 Docker 이미지

    docker build -t vector-commander:local .
    docker run --rm --name vector-commander \
      -p 127.0.0.1:3000:3000 \
      -p 127.0.0.1:8000:8000 \
      vector-commander:local

### Apple Container

    ./scripts/build-apple-container.sh
    container run --rm --name vector-commander \
      -p 127.0.0.1:3000:3000 \
      -p 127.0.0.1:8000:8000 \
      vector-commander:local

실행 후 다음 주소를 사용합니다.

- Game: http://127.0.0.1:3000
- API: http://127.0.0.1:8000
- OpenAPI: http://127.0.0.1:8000/docs

## 로컬 개발

### Backend

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

### Frontend

    cd frontend
    cp .env.example .env.local
    npm ci
    npm run dev

## 검증

    cd backend
    .venv/bin/python -m pytest -q

    cd ../frontend
    npm run lint
    npm run build

GitHub Actions에서도 백엔드와 프론트엔드 검증을 각각 실행합니다.

## 게임 흐름

1. 예산으로 필요한 방역팀을 편성합니다.
2. 지도에서 하나 이상의 지하철 역세권을 작전 구역으로 추가합니다.
3. 각 역세권에 정책 조합을 별도로 배정합니다.
4. 총예산과 총 방역팀 소요량을 확인합니다.
5. 동시 작전을 실행하거나 무대응으로 1주를 진행합니다.
6. 갱신된 개체수, 번식지, 감염 유입, 생활인구와 이동 경로를 비교합니다.

지원 정책은 유충 구제, 성충 방제, 번식지 제거, 감시 강화,
유인산란트랩, 서식지 정밀지도, 주민 행동 캠페인, 표적 현장점검입니다.

## 모델 투명성

SampleMosquitoAdapter와 SampleStationAdapter는 강전영 교수의 공개
연구에서 기술된 공간 ABM 구조를 기반으로 재구성한, 소프트웨어와
게임플레이 검증용 샘플 모델입니다.

- 온도와 강수에 따른 번식 압력
- 유충 성장과 자연 사망
- 성충 우화와 자연 사망
- 인접 자치구 및 연결 역세권 간 확산 압력
- 지역별 수계, 인구, 열섬 지수
- 실제 승하차량을 입력으로 한 역세권 생활인구·승객 흐름 추정
- 정책별 번식지, 유충, 성충, 감염 비율 감소 효과

shared/config/sample_scenario.json의 비용과 생태 파라미터는 예시값입니다.
역 좌표와 2025년 일평균 승하차량은 공개 데이터에서 얻은 관측값입니다.
역세권 생활인구, 승객 OD, 감염 유입, 서식 압력과 이동량은 실시간 통신사
또는 서울시 OD 자료가 아닌 시나리오 계산값입니다.

## 연구 참고문헌

- Kang, J.-Y. and Aldstadt, J. (2017).
  [The influence of spatial configuration of residential area and vector populations on dengue incidence patterns in an individual-level transmission model](https://doi.org/10.3390/ijerph14070792).
  International Journal of Environmental Research and Public Health, 14(7), 792.
- Kang, J.-Y. and Aldstadt, J. (2019).
  [Using multiple scale space-time patterns in variance-based global sensitivity analysis for spatially explicit agent-based models](https://doi.org/10.1016/j.compenvurbsys.2019.02.006).
  Computers, Environment and Urban Systems, 75, 170-183.

## 데이터 출처

프로젝트에 포함된 값은 공식·외부 관측 데이터, 이를 가공한 값, 게임용
추정값으로 구분됩니다. 화면에 표시되는 모든 값이 서울시 실측값인 것은
아닙니다.

### 외부 관측 데이터

| 데이터 | 원 출처와 기준 | 프로젝트 내 가공 | 라이선스·고지 |
| --- | --- | --- | --- |
| 서울 25개 자치구 경계 | KOSTAT 인구주택총조사용 행정경계, 2013년판을 배포하는 [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps) | 단순화된 `municipalities.geojson`을 지도 배경과 역의 자치구 판정에 사용 | Apache License 2.0 |
| 지하철역 이름·호선·좌표 | 서울시 교통정책지원시스템(TAIMS) [지하철역 좌표정보 API, 데이터 ID 1036](https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036). 역사 마스터, 분기 1회 갱신 | 주요 53개 역을 선별하고 환승역의 호선 정보를 합쳐 `subway_stations.json`에 저장 | 저작자 표시(BY), 변경 및 2차적 저작물 작성 허용 |
| 역별 승차·하차 인원 | 서울 열린데이터광장 [OA-12914, 서울시 지하철호선별 역별 승하차 인원](https://data.seoul.go.kr/dataList/OA-12914/S/1/datasetView.do). 교통카드 정산시스템의 일 단위 자료 | 2025년 1~12월 월별 CSV의 승·하차를 역 이름 기준으로 합산해 일평균 승하차량 산출 | [공공누리 제1유형](https://www.kogl.or.kr/info/licenseType1.do): 출처표시, 상업적 이용·변경 가능 |

서울시 승하차 원자료의 저작권자는 서울특별시·코레일·공항철도이며,
제공기관은 서울특별시입니다. 신분당선 자료는 OA-12914 제공 범위에
포함되지 않습니다.

### 프로젝트 가공 데이터

| 항목 | 생성 방식 | 성격 |
| --- | --- | --- |
| 53개 주요 역 목록 | 승하차 규모와 게임 지도 가독성을 고려해 수동 선별 | 전체 서울 지하철역 목록이 아님 |
| 71개 역 연결 구간 | 1~9호선의 선택된 주요 역 순서를 연결 | 선택되지 않은 중간역을 생략한 전술망이며 실제 선로 토폴로지와 동일하지 않음 |
| 기본 구간 승객량 | 양 끝 역 일평균 승하차량 중 작은 값의 16%로 설정 | 공식 OD 통계가 아닌 초기 게임 계수 |
| 역 활동 유형 | 2025년 승하차 패턴에서 평일우위형·도심혼합형 등으로 분류 | 서울시 공식 역 분류가 아님 |
| 역의 소속 자치구 | 역사 좌표가 포함되는 GeoJSON 다각형으로 계산 | 경계상 역은 출입구별 행정구역과 다를 수 있음 |

가공 결과와 출처 메타데이터는
[`backend/data/seoul/subway_stations.json`](backend/data/seoul/subway_stations.json),
세부 데이터 고지는
[`backend/data/seoul/README.md`](backend/data/seoul/README.md)와
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)에 기록되어 있습니다.

### 게임 시나리오 추정값

아래 값은 외부 기관의 실측 자료가 아니라 Simulation Core가 재현 가능한
규칙으로 계산하는 게임 상태입니다.

| 화면·API 항목 | 계산 근거 |
| --- | --- |
| 역세권 생활인구 | 실제 승하차량, 역 활동 유형, 해당 턴의 유입 승객량을 조합한 추정치 |
| 역간 승객 흐름 | 전술망 기본 구간량, 환승역 보정, 턴별 결정론적 변동으로 계산한 방향성 흐름 |
| 역세권 모기 성충·유충·번식지 | 기온, 강수, 서식 압력, 인접 역세권 압력과 정책 효과를 반영한 샘플 ABM 상태 |
| 감염 유입·노출 위험 | 추정 생활인구와 승객 유입, 모기·번식지 상태를 결합한 게임 지표 |
| 서식 압력·수계·열섬 지수 | 샘플 시나리오를 위해 생성하거나 설정한 상대 지수 |
| 자치구 등록인구 | `sample_scenario.json`에 둔 반올림 스냅샷. 최신 공식 통계가 아님 |
| 자치구 생활인구 | 등록인구와 주차·턴 패턴으로 계산한 추정치 |
| 기온·강수 | 초기 샘플값에서 주차와 턴에 따라 생성한 시나리오 날씨 |
| 예산·방역팀·정책 비용 | 게임 밸런스를 위한 설정값 |

### 현재 사용하지 않는 데이터

현재 버전은 서울 생활인구 250m 원자료, 통신사 유동인구, 실제 역간 OD,
실시간 교통 데이터, 감염병 확진 자료, 모기 채집·트랩 관측자료를 직접
불러오지 않습니다. 따라서 화면의 생활인구, 감염 유입, 모기 이동 및
위험도는 운영·보건 의사결정용 통계로 사용할 수 없습니다.

## 디렉터리

    backend/
      app/api/             FastAPI routes
      app/simulation/      game layer, schemas, adapters
      data/seoul/          district boundary and subway scenario data
      tests/               API and simulation tests
    frontend/
      src/app/             Next.js application
      src/components/      map and command panel
      src/lib/             API client and shared types
    shared/config/         sample scenario
    scripts/               container entry and Apple build helper

## 라이선스

프로젝트에서 직접 작성한 코드는 MIT License로 배포합니다. 포함된 서울
경계 데이터는 Apache License 2.0을 따릅니다. 자세한 제3자 고지는
THIRD_PARTY_NOTICES.md를 확인하세요.
