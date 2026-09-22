# pane-by-pane

> 플레이: <https://kairess.github.io/pane-by-pane/> · 영어 소개는 [README.md](README.md)에 있습니다. 이 문서는 설계와 구현 세부를 담은 한국어 원본입니다. 웹 UI는 브라우저 언어에 따라 한국어/영어로 표시되며 헤더의 언어 버튼으로 바꿀 수 있고, `main`에 push하면 GitHub Pages로 배포됩니다(`.github/workflows/pages.yml`).

Glimmith 스타일 "격자 분할" 퍼즐의 **엔진** — level generator + solver + uniqueness validator + difficulty estimator.
TypeScript로 작성되어 있고 외부 런타임 의존성이 없어서 나중에 그대로 static webpage / Web Worker에 올릴 수 있습니다.

배경 조사는 [docs/IDEA.md](docs/IDEA.md), 룰 분석은 [docs/GIMMICKS.md](docs/GIMMICKS.md) 참고.

## 구현된 룰 (S급 8종 + 파생)

| 룰 | clue 타입 | 설명 |
| --- | --- | --- |
| Area Number | `areaNumber` | clue 셀이 속한 region의 넓이 = N (clue 없는 region은 자유) |
| Range / Min / Max / Precision | `range` | 모든 region이 `min ≤ 넓이 ≤ max` (`min === max`가 Precision) |
| Shape Bank | `shapeBank` | 모든 region의 모양이 bank 안에 있음 (회전·반사 동일 취급) |
| Polyomino | `polyomino` | clue 셀이 속한 region의 모양이 지정 polyomino |
| Gemini | `gemini` | 마커 edge는 경계이고 양쪽 region 모양이 같음 |
| Delta | `delta` | 마커 edge는 경계이고 양쪽 region 모양이 다름 |
| Rose Window / Solitude | `rose` | 모든 region이 각 symbol을 정확히 하나씩 포함 (`symbolCount: 1`이 Solitude) |
| Size Separation | `sizeSeparation` | 경계를 공유하는 region은 넓이가 다름 |

## 사용

### 플레이 (web UI)

```sh
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/ 에 static 사이트 생성 (어디에나 올릴 수 있음)
```

왼쪽 패널에서 크기·룰·별점을 고르고 **퍼즐 생성**을 누르면 Web Worker가 퍼즐을 만듭니다.
"비정형 격자"를 켜면 직사각형에서 일부 칸을 파낸 보드가 나옵니다. 좌우/상하 대칭으로 먼저 파낸 뒤 몇 칸을 더 뚫거나 되살려 비대칭 변형을 주고, 연결 유지·막다른 1칸 없음 조건은 항상 지킵니다. Shape Bank 단독 퍼즐은 이 모드에서만 성립합니다. 모바일에서는 세로로 긴 크기(예: 6×8)를 권합니다.
조작은 원작을 모바일에 맞게 옮긴 것입니다(설계 근거는 [docs/CONTROLS.md](docs/CONTROLS.md)).

- 빈 칸 탭: 새 구역 시작(색 자동 배정). 칸 드래그: 지나간 칸을 같은 구역으로 잇기(경계선은 못 넘음). 드래그가 다른 색 구역에 닿으면 그 구역 전체가 현재 색으로 합쳐집니다.
- 칠한 칸 탭: 그 칸 지우기. 칠한 칸에서 드래그: 그 색으로 잇기.
- 칸 사이 경계 탭: 경계선 그리기, 다시 탭하면 지우기(손을 뗄 때 적용되며, 경계에서 시작한 드래그는 칠하기로 처리). 칠한 칸 두 번 탭: 그 구역 둘레에 경계선 일괄(이미 다 둘러져 있으면 제거). 칸 길게 누르기: 칠한 구역이면 그 구역의 넓이, 빈 칸이면 벽이나 색칠에 막히지 않고 이어진 빈 칸의 수. 오류 빗금은 단서가 있는 칸에서는 가장자리 띠로만 그려 단서가 가려지지 않는다.
- 완성 판정은 원작처럼 두 갈래: 경계선을 전부 그리거나, 칸을 전부 칠하면 자동으로 "완성".
- 도구: 되돌리기/다시 실행(⌘Z/⇧⌘Z), 지우개(드래그로 여러 칸의 색을 지움), 오류 표시(기본 항상: 룰을 명시적으로 어긴 칸에만 검붉은 빗금. 정답이나 solver와 비교하지 않으므로 눌러보기로 답을 알아낼 수 없음), 힌트(논리 solver의 다음 추론을 기법 설명과 함께), 정답 보기.
- 진행 상태는 자동 저장되어 새로고침해도 유지됩니다. URL의 `#…seed=` 로 같은 퍼즐을 다시 열 수 있습니다.

### 엔진 CLI

```sh
npm run typecheck
npm test               # node --test

node src/cli.ts gen   --size 6 --rules areaNumber,gemini,delta --stars 2-3 --count 3 --seed 1
node src/cli.ts gen   --size 6 --rules shapeBank,delta --bank 3 --min 3 --max 5 --stars 4-5
node src/cli.ts gen   --size 6 --rules rose,polyomino --rose 2 --min 3 --max 5
node src/cli.ts gen   --w 6 --h 8 --rules shapeBank --min 2 --max 6 --mask   # 비정형 격자, 원작 카탈로그 bank
node src/cli.ts batch --size 6 --rules areaNumber,range --count 30      # 난이도 분포
node src/cli.ts gen   ... --json out.json && node src/cli.ts solve out.json
```

Node 22.18+ 가 TypeScript를 바로 실행하므로 빌드 단계가 없습니다.

### 라이브러리로

```ts
import { generate, solve, solveLogically, render } from './src/engine/index.ts';

const g = generate({ width: 6, height: 6, rules: ['areaNumber', 'gemini', 'delta'], stars: [3, 4] });
console.log(render(g.puzzle));            // 퍼즐
console.log(render(g.puzzle, g.solution)); // 정답
solve(g.puzzle, { limit: 2 }).solutions.length; // 1
solveLogically(g.puzzle).steps;           // 추론 기록
```

## 퍼즐 포맷

```jsonc
{
  "width": 6, "height": 6,
  "clues": [
    { "type": "areaNumber", "cell": 7, "value": 4 },      // cell = y*width + x
    { "type": "range", "min": 3, "max": 6 },
    { "type": "shapeBank", "shapes": ["0,0;0,1;0,2;1,2"] }, // canonical shape key
    { "type": "polyomino", "cell": 20, "shape": "0,0;0,1;0,2;1,2" },
    { "type": "gemini", "edge": { "a": 3, "b": 4 } },        // 인접한 두 셀
    { "type": "delta",  "edge": { "a": 9, "b": 15 } },
    { "type": "rose", "symbolCount": 2, "symbols": [{ "cell": 0, "symbol": 0 }, { "cell": 5, "symbol": 1 }] },
    { "type": "sizeSeparation" }
  ],
  "holes": [0, 5, 42, 47]   // 선택: 보드에서 빠진 칸 (비정형 격자)
}
```

정답은 셀별 region label 배열입니다. 셀 사이 edge가 JOIN/WALL인지가 실제 상태이고 색은 UI 표현일 뿐입니다.

## 구조

```
src/engine/
  grid.ts        격자·edge 인덱싱
  shape.ts       polyomino 정규화(회전·반사), 이름(T4, L5 …)
  state.ts       solver 상태: edge(UNKNOWN/JOIN/WALL) + component + 단조 fact(넓이 범위, 모양 후보)
  rules/         룰 하나 = 파일 하나. init / propagate / mergeConflict / placementConflict / check
    core.ts      모든 룰이 공유하는 추론: size-full, merge-conflict, forced-exit, reach, shape-place
  engine.ts      전파 루프(fixpoint), 최종 검증
  solver.ts      Solver A: 완전 탐색 (유일해 판정)
  logical.ts     Solver B: 사람식 solver — 가장 싼 tier부터 적용, what-if 깊이 측정 → 난이도/별점
  generator/
    mask.ts      비정형 보드: 대칭 기반 침식 + 비대칭 변형, 연결·막다른 칸 없음 보장
    bankCatalog.ts 원작 Shape Bank 도형 46종과 빈도 (docs/SHAPE_BANK.md에서 생성)
    partition.ts 랜덤 분할(growth) / shape bank 타일링
    clues.ts     정답에서 참인 clue 후보 전부 도출
    generate.ts  solution-first 파이프라인: 전체 clue → 유일해 확인 → 오라클 기반 최소화
  render.ts      ASCII 렌더링
src/cli.ts       CLI
src/web/         static web UI (Vite): main.ts(패널·상태·저장), board.ts(Canvas 보드·제스처), model.ts(플레이어 마크: 색·벽·X, undo), analysis.ts(완성 판정·오류 귀속·힌트), worker.ts(생성 worker)
index.html
```

### 룰 간 상호작용이 생기는 방식

각 component는 `lo..hi`(넓이 범위)와 `shapes`(허용 모양 집합), `notShapes`를 가집니다.
룰은 이 fact만 좁히고(Area Number → `lo=hi=N`, Shape Bank → `shapes=bank`, Gemini → 양쪽 fact 교집합, Delta → 상대 모양 제외),
`core.ts`가 fact로부터 edge 추론을 뽑습니다. 그래서 Area Number → Gemini → Shape Bank 같은 연쇄가 별도 코드 없이 나옵니다.

### 생성 파이프라인

1. 랜덤 분할(정답)을 만든다. Shape Bank가 켜져 있으면 랜덤 bank로 타일링한다. region 크기 범위는 따로 주지 않으면 판 크기와 목표 별점에서 정한다(`autoSizeBand`: 6×6은 3~6, 8×8은 3~7, 어려운 목표면 위로, 쉬운 목표면 아래로 옮기고 정답마다 조금씩 흔든다). 큰 region일수록 clue가 적고 what-if가 많아져 어려운 창이 나오므로, 크기 범위는 사용자 설정이 아니라 난이도 조준의 일부다. 웹에는 입력란이 없고 CLI의 `--min/--max`와 엔진 옵션으로만 지정한다.
2. 정답에서 참인 clue 후보를 전부 뽑는다 (모든 셀의 넓이 숫자, 경계 edge마다 Gemini/Delta 마커, …).
3. 후보 전체를 넣은 퍼즐이 그 정답만을 가지는지 완전탐색 solver로 확인한다. 아니면 1로.
3′. Shape Bank + 비정형 격자에서 전체 clue로도 유일해가 아니면, 두 해가 갈리는 edge에 닿는 정답 region을 보드에서 파내고 다시 확인한다(최대 4회).
4. clue를 하나씩(쉬운 목표면 먼저 4개 묶음으로) 빼 보며 **오라클**이 통과하는 동안만 제거한다.
   오라클 = "논리 solver가 완주하고 별점 ≤ 목표 상한". 논리 solver는 건전한 추론만 하므로 완주 자체가 유일해 증명이다.
   유일해만 기준으로 최소화하면 모든 clue가 필수인 expert 퍼즐만 나오기 때문이다.
5. 별점이 목표 하한 미만이거나 clue가 너무 많으면 버린다. 난이도는 정답보다 "어느 clue가 남느냐"에 훨씬 크게 좌우되므로(같은 정답도 순서에 따라 2~7★), 같은 정답으로 순서를 바꿔 최대 8번(`ordersPerSolution`) 다시 최소화한 뒤에야 1로 돌아간다. 결과가 반복되면(지울 지역 clue가 없는 조합) 바로 새 정답으로 넘어간다.
6. 전체 clue를 다 넣어도 목표 상한을 넘는 조합(1★ 요청 등)은 상한을 그 값으로 올려 "가능한 한 쉬운" 창을 만든다. 시도 예산 안에 목표 별점 범위에 들지 못하면 가장 가까웠던 퍼즐을 `missed` 플래그와 함께 돌려주고, 웹과 CLI는 그 사실을 표시한다. 장미창·폴리오미노 단독처럼 구조상 높은 별이 나오지 않는 조합이 있다.

6×6 기준 Area Number/Gemini/Delta 조합은 퍼즐당 1초 안팎, Shape Bank 조합은 5~10초 정도입니다.

### 난이도

solver 시간이 아니라 추론 기록으로 계산합니다.

| tier | 기법 |
| --- | --- |
| 1 | size-full, marker-wall, same-symbol |
| 2 | merge-conflict, forced-exit |
| 3 | reach-exact, shape-place, lookahead (반대로 놓으면 규칙 검사가 즉시 실패하는 edge) |
| 4 | 짧은 what-if (모순까지 안에서 정해지는 edge ≤ 3) |
| 5 | what-if 연쇄 (≤ 10) |
| 6 | 깊은 what-if (> 10) |

what-if의 등급은 라운드 수가 아니라 가정 안에서 확정된 edge 수로 매깁니다(강제 연결이 복도를 따라 이어지는 것은 라운드가 많아도 한눈에 보이므로).

`difficulty = maxTier + (what-if 비용 합 + 0.2 × 직접 추론 비용 합) / 격자 크기 보정`, tier별 비용 `0.1 / 0.25 / 0.5 / 1 / 2 / 3.5`, 별점 경계 `[3.5, 5.5, 8, 10.5, 14, 18]`.
대략 2★ = 배치/도달/lookahead까지, 3★ = 짧은 what-if 하나, 4★ = 짧은 what-if 여럿 또는 연쇄 하나, 5★ = 깊은 what-if 하나, 6★ = 깊은 what-if + 연쇄, 7★ = 깊은 what-if 둘 이상. 최소 단서 6×6은 대체로 2~5★, 8×8은 4~7★에 놓입니다.
1단계 what-if로도 못 푸는 퍼즐은 기본적으로 버립니다(`--guess`로 허용).

## 알려진 한계 / 다음 단계

- Area Number는 원작처럼 "clue 없는 region은 자유"이므로 Area Number 단독으로는 유일해 퍼즐이 거의 안 나옵니다. Range·Gemini/Delta·Rose와 조합하세요.
- Shape Bank 단독은 직사각형에서는 2×2 정사각형 bank 외에 유일해가 없으므로 비정형 격자(`--mask`)와 함께 쓰세요. bank는 원작에서 쓰인 도형 카탈로그(`bankCatalog.ts`) 46종 전체에서 빈도 가중치로 뽑고(모노미노·도미노·큰 직사각형 포함), 개수는 원작 분포(1~3개)를 따릅니다(`--bank N`으로 고정, `--min/--max`로 도형 크기 필터). Shape Bank가 켜지면 region 크기 설정은 무시됩니다. bank만으로 타일링이 유일하지 않으면 정답의 region 하나를 통째로 파내(정답은 유효하게 유지) 다른 해를 없애는 수선을 최대 4회(`--repairs N`) 합니다. 이 덕분에 Shape Bank 단독도 평균 15회 시도, 0.5초 안에 나옵니다.
- 규칙 하나만 켰을 때: Area Number, Shape Bank, Polyomino, Rose(기호 2종 이상)는 그 규칙의 단서만으로 생성됩니다. Range와 Rose 기호 1종(원작의 "유일")은 단서가 칸에 놓이지 않으므로 "고정 경계선 모드"로 생성합니다. 정답의 경계선을 전부 고정 경계선으로 깔고 규칙만으로 정답이 유지되는 동안 하나씩(4개 묶음 먼저) 지운 뒤 나머지 단서를 최소화합니다. 이 모드는 "고정 경계선" 옵션과 무관하게 항상 벽을 씁니다. 벽과 단서 중 먼저 지우는 쪽이 사라지고 남는 쪽이 퍼즐을 떠받치므로, 어려운 목표(하한 3★ 이상)면 벽을 먼저(정답당 한 번) 지워 표식·기호가 정보를 맡게 하고, 그 외에는 단서를 먼저 지운 뒤 벽을 다듬습니다. 넓이 구분은 분할을 키울 때 이웃과 다른 크기를 고르도록 해(`growOnce`) 7×7에서도 바로 나옵니다. Gemini/Delta/Size Separation만 켜면(넓이를 아래로 묶는 규칙이 없으면) 구역을 둘로 쪼개는 것을 막는 것은 표식뿐이므로, 원작의 표식 창처럼 구역을 1~3칸(가끔 4칸)으로 작게 만듭니다. 그래야 어떤 쪼개기도 표식을 깨뜨립니다(측정: 비정형 격자에서 "벽 전부 + 표식 전부"가 정답을 고정하는 비율이 1~3칸이면 절반, 1~4칸이면 1/10, 1~5칸이면 0). 그 뒤 벽과 표식을 최소화하는 것은 같습니다. 원작의 4×4 표식 퍼즐(굵은 납선 5개, δ 둘, Ⅱ 하나)을 엔진에 넣으면 해가 하나로 나옵니다.
- 고른 규칙은 최종 퍼즐에 최소 한 번은 나타납니다. 정답에서 그 규칙의 단서를 하나도 못 만드는 시도(쌍둥이인데 같은 모양의 이웃 구역이 없음 등)는 버리고, 최소화 단계에서는 규칙별 마지막 단서를 불필요하더라도 남깁니다. "고정 경계선"을 켜면 벽도 최소 1개는 둡니다. Gemini + Size Separation은 함께 쓸 수 없습니다(같은 모양이면 넓이도 같은데 이웃 넓이가 달라야 함). 웹은 즉시 안내합니다.
- Rose 단독(또는 Rose + Gemini/Delta/Size Separation처럼 경계를 만들지 못하는 규칙과의 조합)은 "장미창 단독 모드"로 생성합니다. 기호 없는 칸은 어느 이웃 구역에 붙어도 규칙을 어기지 않으므로, 기호를 구역의 끝 칸(없애도 구역이 끊기지 않는 칸: 길의 양 끝, T의 세 끝)에 두어 나머지 칸이 모두 다리가 되게 합니다. 그래서 구역 넓이는 기호 수 k에 대해 [k, k+2]로 제한하고(넓이 구분과 함께면 [k, k+3]; 사용자 설정보다 우선), 분할 단계에서 끝 칸이 k개보다 많은 모양으로 자란 구역은 그 자리에서 몇 번 다시 키웁니다(`maxTips`). 장미창 단독 모드도 고정 경계선 모드를 거칩니다. 직사각 판에서는 2×2 블록 안의 도미노 두 개가 기호를 대각선으로 가지면 어느 쪽으로도 짝지을 수 있어 벽 하나가 있어야 정해지는데, 최소화가 필요 없는 벽은 모두 걷어내므로 비정형 판에서는 대개 벽 없이 끝납니다. 6×6, k=2~4에서 시도 수십 번 안에 나오며 원작의 장미창 스테이지처럼 기호가 촘촘한 2~4칸 구역 퍼즐이 됩니다. k=1(Solitude)은 단독으로는 유일해가 불가능하니 다른 규칙과 조합하세요. 다른 규칙과 함께일 때도 끝 칸을 우선 채우되, 끝 칸이 k개를 넘는 큰 구역은 무작위로 둡니다.
- 논리 solver는 직접 추론 + 1단계 what-if까지만 지원합니다. `--guess`로 유일해만 기준으로 최소화하면 더 깊은 추론이 필요한 퍼즐이 나올 수 있습니다.
- 사람이 쓰는 전역 계수 논리(숫자 합 = 셀 수 → 모든 셀이 어떤 숫자 region에 속함)는 아직 없습니다. 추가하면 Area Number 퍼즐의 what-if 수가 줄어들 것입니다.
- 아직 없는 것: 흥미도(interestingness) 필터, A급 룰(Boxy, Inequality, Difference …), PWA/모바일 다듬기, 퍼즐 저장·진행도.

## UI 용어

웹 UI는 원작 한글판(나무위키 정리 기준)의 용어를 따릅니다: 창(퍼즐), 칸, 구역(region), 경계선, 넓이. 규칙 이름은 넓이의 수(Area Number), 넓이의 범위(Range), 정밀한 넓이(Exact Area), 도형 창고(Shape Bank), 폴리오미노, 쌍둥이(Gemini), 닮지 않은 둘(Delta), 장미창(Rose), 넓이 구분(Size Separation).

## 화면 디자인

스테인드글라스를 완성한다는 느낌을 목표로 합니다. 보드는 어두운 돌벽(무대) 위에 놓이고, 칠한 구역은 한 장의 색유리(보석 톤 팔레트, 구역 단위의 방사형 빛과 유리 결 패턴)로, 아직 안 칠한 칸은 옅은 투명 유리로, 구멍은 뒤의 돌벽으로 보입니다. 고정 경계선과 바깥 틀은 납선(어두운 막대 위에 얇은 하이라이트)이고, 플레이어의 경계선은 파란 스케치 선입니다. 단서 숫자는 세리프 서체로 유리에 새겨진 것처럼 그립니다. 인접 구역은 같은 색은 물론 같은 색 계열(사파이어/하늘, 에메랄드/라임 등)도 피해서 배정합니다.

창을 직접 완성하면(정답 보기가 아닐 때만) 점선 절단선이 사라지고, 파란 선이 납선으로 바뀌며, 유리색이 깊어지면서 창 윤곽을 따라 빛이 번지고 무대가 어두워집니다. 이어서 햇빛 한 줄기가 창을 대각선으로 가로지르고(처음엔 강하게, 이후 14초마다 약하게), 구름이 지나가듯 부드러운 빛 두 덩이가 유리 위를 천천히 떠다닙니다. 표시를 바꾸면 다시 작업 중 상태로 돌아옵니다. `prefers-reduced-motion`이면 완성 상태는 정지 화면으로 둡니다. 구현은 `board.ts`의 `setComplete`/`tick`/`drawShine`(캔버스 애니메이션)과 `style.css`의 `.lit`(무대·글로우 전환)입니다.

## 목표 요약 띠

목표 다이얼로그를 열지 않아도 규칙이 보이도록, 창 위에 규칙마다 짧은 칩을 한 줄로 둡니다(예: "넓이 3–6", 도형 창고의 도형 아이콘, "= 같은 모양", "○△ 하나씩"). 모바일에서는 난이도 별도 칩으로 들어가고, 칩이 많으면 두 줄로 접힙니다. 칩이나 "?"를 누르면 전체 설명이 열립니다. 처음 방문할 때 한 번만 이 띠 아래에 안내 말풍선을 띄워(누르면 자세한 설명, 드래그로 색칠, 칸 사이를 눌러 경계선) 알려주고, "알겠어요"를 누르거나 목표를 열거나 첫 표시를 하면 사라집니다(`localStorage`의 `pbp:coach`).

## 햅틱

칸을 칠하거나 지울 때마다 한 번씩 진동이 옵니다. Android는 Vibration API를 씁니다. iOS Safari에는 그 API가 없고, iOS 26.5부터는 `<input type=checkbox switch>`를 스크립트로 눌러 진동을 내는 편법도 막혔습니다. 남은 길은 하나입니다. 실제 손가락이 스위치를 토글하거나, 스위치를 **드래그하는 동안** 엄지가 뒤집힐 때 WebKit이 직접 내는 진동입니다. 그래서 창 위에 보이지 않는 스위치를 하나 깔아 두고, 스트로크 중에 칸이 바뀔 때마다 스위치를 손가락 밑에서 반대편으로 옮겨 "트랙 중앙을 넘은 것"으로 만듭니다. 탭은 놓는 순간 스위치가 토글되며 스스로 진동을 냅니다. 자세한 것은 `src/web/haptics.ts`에 있습니다. 주소 뒤에 `?debug=haptic`을 붙이면 그 스위치가 반투명하게 보입니다.

## 고정 경계선 (fixed walls)

원작의 납선처럼 보드에 미리 그어진 경계선입니다. `Puzzle.walls` (`{a,b}` 셀 쌍)로 표현하며, 구멍(`holes`)과 마찬가지로 clue가 아니라 보드의 일부라서 최소화 대상이 아닙니다. 엔진은 `FixedWallsRule`로 처리합니다(초기 상태에서 벽 확정, 검증 시 양쪽 label이 달라야 함). 생성기는 정답의 경계 edge 중 일정 비율(`walls: true`면 10~30%)을 짧은 직선 구간으로 골라 고정합니다. CLI는 `--walls [비율]`, 웹은 "고정 경계선" 체크박스입니다. 붓은 고정 경계선을 넘지 못하므로(그린 경계선과 같음) 가로질러 드래그해도 반대쪽은 칠해지지 않고, 고정 경계선은 탭해도 지워지지 않습니다. 저장된 옛 상태 등으로 같은 색이 고정 경계선을 가로지르면 그 경계선에 검붉은 빗금이 표시됩니다.
