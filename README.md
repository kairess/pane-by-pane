# pane-by-pane

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

- 빈 칸 탭: 새 region 시작(색 자동 배정). 칸 드래그: 지나간 칸을 같은 region으로 잇기(벽은 못 넘음). 드래그가 다른 색 영역에 닿으면 그 영역 전체가 현재 색으로 합쳐집니다.
- 칠한 칸 탭: 그 칸 지우기. 칠한 칸에서 드래그: 그 색으로 잇기.
- 칸 사이 경계 탭: 벽 그리기, 다시 탭하면 지우기(손을 뗄 때 적용되며, 경계에서 시작한 드래그는 칠하기로 처리). 칸 길게 누르기: 그 영역의 칸 수.
- 완성 판정은 원작처럼 두 갈래: 벽을 전부 그리거나, 칸을 전부 칠하면 자동으로 "완성".
- 도구: 되돌리기/다시 실행(⌘Z/⇧⌘Z), 지우개(드래그로 여러 칸의 색을 지움), 가정 모드(이후 표시가 반투명으로 쌓이고 확정/버리기), 오류 표시(기본 항상: 룰을 명시적으로 어긴 칸에만 검붉은 빗금. 정답이나 solver와 비교하지 않으므로 눌러보기로 답을 알아낼 수 없음), 힌트(논리 solver의 다음 추론을 기법 설명과 함께), 정답 보기.
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

1. 랜덤 분할(정답)을 만든다. Shape Bank가 켜져 있으면 랜덤 bank로 타일링한다.
2. 정답에서 참인 clue 후보를 전부 뽑는다 (모든 셀의 넓이 숫자, 경계 edge마다 Gemini/Delta 마커, …).
3. 후보 전체를 넣은 퍼즐이 그 정답만을 가지는지 완전탐색 solver로 확인한다. 아니면 1로.
3′. Shape Bank + 비정형 격자에서 전체 clue로도 유일해가 아니면, 두 해가 갈리는 edge에 닿는 정답 region을 보드에서 파내고 다시 확인한다(최대 4회).
4. clue를 하나씩(먼저 4개 묶음으로) 빼 보며 **오라클**이 통과하는 동안만 제거한다.
   오라클 = "논리 solver가 완주하고 별점 ≤ 목표 상한". 논리 solver는 건전한 추론만 하므로 완주 자체가 유일해 증명이다.
   유일해만 기준으로 최소화하면 모든 clue가 필수인 expert 퍼즐만 나오기 때문에 이 방식을 쓴다.
5. 별점이 목표 하한 미만이거나 clue가 너무 많으면 버리고 1로.

6×6 기준 Area Number/Gemini/Delta 조합은 퍼즐당 1초 안팎, Shape Bank 조합은 5~10초 정도입니다.

### 난이도

solver 시간이 아니라 추론 기록으로 계산합니다.

| tier | 기법 |
| --- | --- |
| 1 | size-full, marker-wall, same-symbol |
| 2 | merge-conflict, forced-exit |
| 3 | reach-exact, shape-place |
| 4 | 짧은 what-if (모순까지 ≤ 2 라운드) |
| 5 | what-if 연쇄 (≤ 5 라운드) |
| 6 | 깊은 what-if |

`difficulty = 0.5 × maxTier + 0.5 × (tier별 가중 작업량 / 격자 크기 보정)`, 별점 경계 `[3, 4.5, 6.5, 9, 12, 16]` (6×6 생성 분포로 보정).
1단계 what-if로도 못 푸는 퍼즐은 기본적으로 버립니다(`--guess`로 허용).

## 알려진 한계 / 다음 단계

- Area Number는 원작처럼 "clue 없는 region은 자유"이므로 Area Number 단독으로는 유일해 퍼즐이 거의 안 나옵니다. Range·Gemini/Delta·Rose와 조합하세요.
- Shape Bank 단독은 직사각형에서는 2×2 정사각형 bank 외에 유일해가 없으므로 비정형 격자(`--mask`)와 함께 쓰세요. bank는 원작에서 쓰인 도형 카탈로그(`bankCatalog.ts`) 46종 전체에서 빈도 가중치로 뽑고(모노미노·도미노·큰 직사각형 포함), 개수는 원작 분포(1~3개)를 따릅니다(`--bank N`으로 고정, `--min/--max`로 도형 크기 필터). Shape Bank가 켜지면 region 크기 설정은 무시되고 UI에서도 숨겨집니다. bank만으로 타일링이 유일하지 않으면 정답의 region 하나를 통째로 파내(정답은 유효하게 유지) 다른 해를 없애는 수선을 최대 4회(`--repairs N`) 합니다. 이 덕분에 Shape Bank 단독도 평균 15회 시도, 0.5초 안에 나옵니다.
- Rose 단독 또는 Rose + Range는 랜덤 분할을 고정하지 못해 생성 실패가 잦습니다. Rose + Polyomino / Rose + Area Number / Rose + Shape Bank는 잘 됩니다.
- 논리 solver는 직접 추론 + 1단계 what-if까지만 지원합니다. `--guess`로 유일해만 기준으로 최소화하면 더 깊은 추론이 필요한 퍼즐이 나올 수 있습니다.
- 사람이 쓰는 전역 계수 논리(숫자 합 = 셀 수 → 모든 셀이 어떤 숫자 region에 속함)는 아직 없습니다. 추가하면 Area Number 퍼즐의 what-if 수가 줄어들 것입니다.
- 아직 없는 것: 흥미도(interestingness) 필터, A급 룰(Boxy, Inequality, Difference …), PWA/모바일 다듬기, 퍼즐 저장·진행도.
