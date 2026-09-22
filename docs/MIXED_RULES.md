# 원작 전 창의 규칙 조합 전수 분석과 생성기 대응

2026-09-22. `HARD_PUZZLES.md`(Act I 어려운 판의 구조)에 이어, **세 Act 전체의 규칙 조합**을 모을 수 있는 자료로 다 모아 집계하고, 원작에 있는데 우리에게 없던 규칙과 조합을 엔진·생성기에 넣었습니다. 특히 여러 규칙이 겹치는 혼합 조합을 봤습니다.

## 자료

| 자료 | 범위 | 얻은 것 |
| --- | --- | --- |
| [glimmith-6ts.pages.dev](https://glimmith-6ts.pages.dev/) | Act I 312개 보드(풀이 단계 포함) | 규칙, 난이도, 정답 분할(HARD_PUZZLES.md) |
| [camzillasmom](https://camzillasmom.com/category/the-artisan-of-glimmith/) 창별 풀이 페이지 17개 | Act I 일부 + Act II 창(넓이의 수·울타리·일치·불일치·범위·유일·넓이 구분·사각틀·숲길 입구) 351개 퍼즐 | 퍼즐마다 "Rules to follow" 목록과 레벨(258개), 스크린샷 |
| 나무위키 | 전 창의 난이도 분포와 "함께 나오지 않는 규칙" 메모 | Act III 창(벽돌·질긴 고리·불평등·차이·감시탑·나침반)의 분포만 |

팬 사이트는 Act II·III 보드 데이터를 아직 올리지 않았고("soon"), camzillasmom은 Act III 창을 아직 다루지 않으며 사각틀 금지 창 페이지가 없습니다. 그래서 **Act I은 보드 단위, Act II는 규칙 목록 단위**로 전수이고, Act III는 규칙 정의와 분포만 있습니다. 두 자료를 합쳐 663개 퍼즐, 114가지 조합(2회 이상 관찰된 조합 83가지)입니다. camzillasmom 페이지의 규칙 목록은 각 퍼즐 설명의 "Rules to follow:" 아래 줄을 파싱한 것이라 드물게 빠진 규칙이 있을 수 있습니다(예: 유일 창의 "Solitude"만 적힌 항목).

## 1. 규칙 수와 난이도

| 규칙 수 | 퍼즐 | 평균 난이도 | 난이도 5 이상 |
| --- | --- | --- | --- |
| 1 | 211 | 2.68 | 18 |
| 2 | 298 | 2.82 | 29 |
| 3 | 140 | 3.46 | 25 |
| 4 | 14 | 4.00 | 5 |

규칙이 하나 늘 때마다 평균 난이도가 0.1~0.6 오릅니다. 다만 난이도 5 이상의 77개 중 단독 규칙이 18개로, 어려움의 주된 원천은 여전히 판 크기입니다(HARD_PUZZLES.md 1절).

## 2. 규칙별 짝

혼합 조합 안에서 각 규칙이 어떤 규칙과 함께 나오는지(상위 5개).

| 규칙 | 전체 | 혼합에서 | 함께 나온 규칙 |
| --- | --- | --- | --- |
| Polyomino | 155 | 126 | Mingle 26, Shape Bank 22, Solitude 22, Precision 20, Gemini 18 |
| Shape Bank | 146 | 92 | Delta 37, Gemini 34, Mingle 25, Polyomino 22, Rose 16 |
| Rose | 130 | 100 | Gemini 24, Polyomino 17, Shape Bank 16, Delta 13, Precision 12 |
| Precision | 126 | 101 | Polyomino 20, Palisade 20, Gemini 18, Delta 16, Mingle 15 |
| Palisade | 107 | 77 | Solitude 45, Precision 20, Area Number 16, Polyomino 15, Mismatch 11 |
| Area Number | 105 | 87 | Solitude 37, Size Separation 19, Palisade 16, Boxy 14, Polyomino 13 |
| Gemini | 100 | 100 | Delta 67, Shape Bank 34, Rose 24, Polyomino 18, Precision 18 |
| Delta | 81 | 81 | Gemini 67, Shape Bank 37, Precision 16, Rose 13, Polyomino 10 |
| Solitude | 72 | 72 | Palisade 45, Area Number 37, Polyomino 22, Boxy 10, Precision 6 |
| Mingle | 71 | 69 | Polyomino 26, Shape Bank 25, Precision 15, Area Number 8, Rose 5 |
| Mismatch | 49 | 39 | Precision 13, Palisade 11, Boxy 8, Polyomino 8, Rose 4 |
| Size Separation | 39 | 34 | Area Number 19, Range 6, Rose 6, Polyomino 5 |
| Boxy | 35 | 35 | Area Number 14, Solitude 10, Mismatch 8, Palisade 7, Rose 4 |
| Range | 23 | 17 | Area Number 7, Size Separation 6, Mingle 3 |
| Match | 21 | 20 | Rose 10, Precision 8, Polyomino 1, Range 1 |
| Minimum / Maximum | 23 | 22 | Area Number 5, Polyomino 5, Gemini 4, Rose 6 |

세 가지가 두드러집니다.

- **울타리(Palisade)가 혼합의 중심**입니다. 유일 창 62개 중 45개가 울타리와 묶이고, 정밀한 넓이·넓이의 수·불일치와도 자주 묶입니다. 우리에겐 없던 규칙입니다.
- **일치(Match)와 사각틀(Boxy)은 단독으로 나오지 않습니다.** 일치는 장미창(10)이나 정밀한 넓이(8)와, 사각틀은 넓이의 수·유일·불일치·울타리·장미창과 묶입니다. 직사각형은 언제나 둘로 잘리기 때문입니다(A_RULES.md).
- **불일치(Mismatch)는 단독(10)과 정밀한 넓이(11)가 주력**이고, 정밀한 넓이와 묶이면 판이 작아집니다(N칸 모양의 가짓수가 구역 수의 상한: 4칸이면 5개 구역 20칸, 5칸이면 12개 60칸).

## 3. 조합 × 난이도 (2회 이상 관찰된 조합)

`분포`는 난이도 1~7의 퍼즐 수(난이도가 적힌 것만). 등장 순.

| 조합 | 퍼즐 | 분포 1..7 | 평균 | 최고 |
| --- | --- | --- | --- | --- |
| Shape Bank | 54 | 12 14 12 7 5 3 1 | 2.9 | 7 |
| Rose | 30 | 8 10 7 3 1 1 0 | 2.4 | 6 |
| Palisade | 30 | 3 6 6 6 1 0 0 | 2.8 | 5 |
| Polyomino | 29 | 8 7 7 5 2 0 0 | 2.5 | 5 |
| Precision | 25 | 2 11 7 2 3 0 0 | 2.7 | 5 |
| Delta+Gemini+Shape Bank | 22 | 6 3 5 4 2 2 0 | 3.0 | 6 |
| Area Number | 18 | | | |
| Area Number+Size Separation | 17 | 5 6 3 2 1 0 0 | 2.4 | 5 |
| Mingle+Shape Bank | 17 | 3 6 4 1 2 1 0 | 2.8 | 6 |
| Delta+Gemini+Precision | 13 | 1 1 2 5 2 2 0 | 3.9 | 6 |
| Palisade+Precision | 13 | 0 5 3 3 0 2 0 | 3.3 | 6 |
| Rose+Shape Bank | 12 | 1 4 3 0 2 1 1 | 3.4 | 7 |
| Precision+Rose | 11 | 1 1 1 1 2 0 0 | 3.3 | 5 |
| Polyomino+Precision | 11 | 0 3 2 0 0 1 0 | 3.0 | 6 |
| Mismatch+Precision | 11 | 1 2 2 5 1 0 0 | 3.3 | 5 |
| Mingle+Polyomino | 10 | 2 2 2 2 1 1 0 | 3.1 | 6 |
| Polyomino+Shape Bank | 10 | 1 2 3 2 0 1 1 | 3.5 | 7 |
| Match+Rose | 10 | | | |
| Mismatch | 10 | 2 2 4 1 0 1 0 | 2.8 | 6 |
| Area Number+Solitude | 10 | 4 4 0 2 0 0 0 | 2.0 | 4 |
| Area Number+Palisade+Solitude | 10 | 0 2 4 2 0 2 0 | 3.6 | 6 |
| Polyomino+Rose | 9 | 1 1 0 3 0 0 0 | 3.0 | 4 |
| Mingle+Precision | 9 | 1 0 2 2 0 0 0 | 3.0 | 4 |
| Delta+Gemini+Rose | 9 | 1 0 1 1 2 0 0 | 3.6 | 5 |
| Delta+Shape Bank | 8 | 3 2 2 1 0 0 0 | 2.1 | 4 |
| Match+Precision | 8 | | | |
| Palisade+Solitude | 8 | 2 4 0 2 0 0 0 | 2.2 | 4 |
| Palisade+Polyomino+Solitude | 8 | 0 4 2 2 0 0 0 | 2.8 | 4 |
| Mingle+Polyomino+Shape Bank | 7 | 0 0 1 4 1 1 0 | 4.3 | 6 |
| Mingle+Polyomino+Precision | 6 | 1 0 0 1 2 0 0 | 3.8 | 5 |
| Gemini+Polyomino+Rose | 6 | 0 0 2 0 2 0 0 | 4.0 | 5 |
| Gemini+Shape Bank | 6 | 3 2 1 0 0 0 0 | 1.7 | 3 |
| Area Number+Boxy+Solitude | 6 | 1 1 2 1 1 0 0 | 3.0 | 5 |
| Mismatch+Polyomino | 6 | 0 3 3 0 0 0 0 | 2.5 | 3 |
| Mismatch+Palisade | 6 | 0 3 2 0 0 1 0 | 3.0 | 6 |
| Range | 6 | 1 3 0 2 0 0 0 | 2.5 | 4 |
| Rose+Size Separation | 6 | 0 3 1 0 1 1 0 | 3.3 | 6 |
| Polyomino+Solitude | 6 | 6 0 0 0 0 0 0 | 1.0 | 1 |
| Palisade+Precision+Solitude | 6 | 0 0 4 2 0 0 0 | 3.3 | 4 |
| Gemini+Rose | 5 | 0 1 1 1 0 0 0 | 3.0 | 4 |
| Delta+Gemini | 5 | 0 2 2 1 0 0 0 | 2.8 | 4 |
| Size Separation | 5 | 0 2 3 0 0 0 0 | 2.6 | 3 |
| Mingle+Rose | 4 | 0 1 2 0 1 0 0 | 3.2 | 5 |
| Delta+Gemini+Polyomino | 4 | 1 1 0 0 0 0 0 | 1.5 | 2 |
| Gemini+Polyomino | 4 | 0 0 1 0 1 0 0 | 4.0 | 5 |
| Gemini+Precision | 4 | 0 0 3 0 1 0 0 | 3.5 | 5 |
| Boxy+Rose | 4 | 2 1 1 0 0 0 0 | 1.8 | 3 |
| Mismatch+Rose | 4 | 1 1 0 1 0 1 0 | 3.2 | 6 |
| Palisade+Rose | 4 | 0 1 2 0 1 0 0 | 3.2 | 5 |
| Area Number+Minimum | 4 | 1 0 2 1 0 0 0 | 2.8 | 4 |
| Minimum+Polyomino | 4 | 1 1 1 1 0 0 0 | 2.5 | 4 |
| Area Number+Range | 4 | 0 2 1 0 0 1 0 | 3.2 | 6 |
| Polyomino+Size Separation | 4 | 0 1 2 1 0 0 0 | 3.0 | 4 |
| Area Number+Polyomino+Solitude | 4 | 0 2 0 0 2 0 0 | 3.5 | 5 |
| Area Number+Palisade+Polyomino+Solitude | 4 | 0 0 2 0 2 0 0 | 4.0 | 5 |
| Delta+Gemini+Rose+Shape Bank | 3 | 0 0 0 1 2 0 0 | 4.7 | 5 |
| Boxy+Precision | 3 | 1 2 0 0 0 0 0 | 1.7 | 2 |
| Area Number+Boxy | 3 | 1 1 1 0 0 0 0 | 2.0 | 3 |
| Boxy+Mismatch | 3 | 0 1 0 1 1 0 0 | 3.7 | 5 |
| Boxy+Palisade+Solitude | 3 | 0 1 0 1 0 1 0 | 4.0 | 6 |
| Boxy+Mismatch+Palisade | 3 | 0 1 1 1 0 0 0 | 3.0 | 4 |
| Maximum+Rose | 3 | 0 2 1 0 0 0 0 | 2.3 | 3 |
| Range+Size Separation | 3 | 1 0 1 1 0 0 0 | 2.7 | 4 |
| 2회 관찰 (20가지) | 40 | | | |

창별 목록(walkthrough 자료): 넓이의 수 창은 단독 18 + 폴리오미노·장미창·쌍둥이·어우러진 모양 각 2~3; 사각틀 창은 넓이의 수+유일 6, 장미창 4, 정밀 3, 불일치 3, 울타리+유일 3, 불일치+울타리 3 …; 숲길 입구는 폴리오미노+정밀 5, 정밀+장미창 5, 어우러진+정밀 4, 쌍둥이·닮지 않은 둘+장미창 4 …; 일치 창은 장미창 10, 정밀 8; 불일치 창은 정밀 11, 단독 10, 폴리오미노 6, 울타리 6, 장미창 4; 울타리 창은 단독 30, 정밀 13, 장미창 4; 범위 창은 최소·최대·범위가 넓이의 수·폴리오미노·장미창·쌍둥이와 20가지로 흩어짐; 넓이 구분 창은 넓이의 수 17, 장미창 6, 단독 5, 폴리오미노 4, 범위 3; 유일 창은 넓이의 수 10, 넓이의 수+울타리 10, 울타리 8, 울타리+폴리오미노 8, 폴리오미노 6, 울타리+정밀 6 ….

## 4. 엔진에 넣은 것

원작 24종 중 우리에게 없던 규칙 가운데 혼합 조합에 나오는 것을 넣었습니다(`src/engine/rules/shapes.ts`, `topo.ts`).

| 규칙 | 전파 | 생성 |
| --- | --- | --- |
| Match `match` | 한 성분이 모양에 고정되면 전부 그 모양으로; 넓이 구간은 전 성분의 교집합 | 카탈로그에서 도형 하나를 골라 타일링(배수 재단·구멍 타일링 재사용) |
| Mismatch `mismatch` | 고정된 모양은 **다른 주머니**(벽으로 갈라진 영역)의 성분에서 제외. **세기 추론 `mismatch-count`**: m칸 이하 모양이 밖에서 전부 쓰였으면 2m+1칸 이하 주머니는 자를 수 없어 안쪽을 이음 | `mismatchPartition`: 3칸 이하 모양 4개(90칸 이상이면 4칸 이하 9개)를 먼저 심고 나머지를 4~7칸 서로 다른 모양으로 키움. 정밀한 넓이와 함께면 판을 (모양 수×N)칸 이하로 재단(`punchToAtMost`) |
| Palisade `palisade` | 타일의 네 변을 시작 사실로(1등급). 가장자리·구멍 쪽 변은 항상 경계 | 숫자처럼 구역의 모든 칸이 후보. 유일의 기호로 셈 |
| Bricky `bricky` | 꼭짓점에 경계선 셋이면 넷째는 이음 | 분할에서 네 구역이 만나는 꼭짓점 거부(`noCross`) |
| Loopy `loopy` | 꼭짓점의 경계선 수가 짝수: 하나만 남으면 홀짝으로 결정. 가장자리 꼭짓점은 변이 하나라 경계선이 가장자리에 못 닿음 | `loopyPartition`: 가장자리와 서로에게 한 칸 여백을 둔 섬들과 그 사이 바다 |
| Watchtower `watchtower` | 1이면 둘레 전부 이음, 칸 수와 같으면 전부 벽; 그 사이는 "둘레 성분 수가 count로 줄면 더 합칠 수 없음"(`mergeConflict`) | 구역 경계의 꼭짓점을 구역당 2개 후보로 |

세기 추론은 처음에 잘못 만들었다가 고쳤습니다. 고정된 모양을 같은 주머니의 성분에서도 제외하면, 나중에 그 성분과 합쳐질 칸이 모순을 일으켜 정답이 거부됐습니다(불일치+폴리오미노가 30/30 `not-unique`). 제외와 세기는 **벽으로 갈라진 다른 주머니**에 대해서만 합니다.

조합 제한(`ruleConflict`)에 더한 것: 일치+불일치, 일치+{어우러진 모양·닮지 않은 둘·넓이 구분·불평등·사각틀 금지}, 불일치+쌍둥이, 섬을 정할 규칙 없는 질긴 고리. 사각틀은 이제 불일치·울타리·감시탑과도 됩니다.

## 5. 원작 조합을 우리 생성기로 (7×7 비정형+벽, seed 1, 시도 30, 1~2★과 5~7★ 요청)

2회 이상 관찰된 83가지 조합 전부를 돌린 결과는 `docs/sweep/sweep-mixed-7x7.log`에 있습니다(불일치+정밀은 N=5). 조치 뒤 결과:

| | 조합 수 |
| --- | --- |
| 1~2★ 요청이 나옴 | 82 / 83 (Mingle 단독만 실패) |
| 5~7★ 요청에 5★ 이상 | 40 |
| 5~7★ 요청에 3~4★ 미달 | 22 |
| 5~7★ 요청에 2★ 이하 미달 | 20 (울타리 계열 7, 폴리오미노·사각틀·장미창+창고 계열) |
| 한 조합의 최대 시간 | 4.7초 |

처음 돌렸을 때의 실패 조합과 원인·조치:

| 조합 (원작 수) | 처음 결과 | 원인 | 조치 |
| --- | --- | --- | --- |
| Mismatch+Precision (11) | `no-partition` | N=4면 모양이 5개뿐이라 20칸이 상한 | 판을 모양 수×N 이하로 재단. N=5 35칸에서 7★ |
| Mismatch+Polyomino (6) | `not-unique` 30/30 | 세기 추론의 제외가 같은 주머니 안 성분에도 적용됨(위) | 주머니 단위로 고침. 2★/6★ |
| Mismatch+Rose (4) | `no-partition` | 장미창 끝 칸 배치가 서로 다른 모양 조건과 충돌 | 불일치가 있으면 기호를 아무 칸에, 구역 k~7칸 |
| Mismatch 단독 (10) | `not-logical` | 세기 추론이 없어 논리 솔버가 못 풂 | `mismatch-count` 추가. 6×6 4★, 7×7 5★ |
| Boxy+Rose (4) | `no-clues` | 직사각형은 끝 칸이 넷이라 기호 강제 배치 실패 | 사각틀이면 기호 아무 칸(직사각형은 어차피 못 자름). 6★ |
| Boxy+Precision (3) | `no-partition` | 비정형 윤곽을 N칸 직사각형으로 못 채움 | 구멍 타일링 재사용. 2★ |
| Boxy+Mismatch (3) | `no-partition` | 정사각 판에서 서로 다른 직사각형 채우기 실패 | 1~12칸 직사각형 타일링, 사각틀에서는 세기 재고를 직사각형으로 한정. 7×7 비정형 2~3★ |
| Palisade+Solitude 계열 (25) | `CONFLICT` | 울타리를 유일의 기호로 안 셈 | 셈. 1★ |
| Mingle 단독 (2) | `no-partition`/`not-unique` | HARD_PUZZLES.md 5절 | 그대로 |

## 6. 남은 차이

- **울타리는 우리 별점으로 1★**입니다. 타일이 변 넷을 바로 정하므로 우리 솔버는 어떤 울타리 퍼즐도 1등급으로 끝냅니다. 원작 울타리 창은 난이도 5까지 있고 유일·정밀과 묶이면 6이 됩니다. 원작의 어려움은 여러 타일을 함께 읽는 데서 오는데, 우리 솔버는 그것을 lookahead로 "바로" 봅니다. 별점 척도의 문제이지 유일해나 구조의 문제는 아닙니다.
- **Compass, Minimum/Maximum 개별 옵션**은 넣지 않았습니다. Compass는 정의(연속한 칸 수인지 방향 전체인지)가 자료마다 달라 보류했고, 최소·최대는 범위 규칙의 약한 형태로 최소화 단계에서만 나옵니다.
- **Act II·III 보드의 형태**(칸 수, 구역 수, 벽 비율)는 자료가 없어 재지 못했습니다. camzillasmom 스크린샷에서 격자를 읽어내면 가능하지만 창마다 배율이 달라 이번에는 하지 않았습니다.
- **불일치+정밀한 넓이 N=4**는 20칸 판이 필요해 7×7 요청은 실패합니다(4×5 등 작은 판을 고르면 됩니다).
