# A급 규칙 검증: Precision · Solitude · Boxy · Non-Boxy · Inequality · Difference

`GIMMICKS.md`가 A급으로 분류한 여섯 규칙을 원작 자료로 다시 확인했습니다(2026-09-22). `SHAPE_BANK.md`와 같은 방식이며, 여기서는 규칙 정의·난이도 분포·동반 규칙 제한·커뮤니티 근거를 출처별로 대조하고, 우리 엔진의 지원 상태를 덧붙였습니다.

## 출처

| 출처 | 쓴 것 |
| --- | --- |
| [나무위키](https://namu.moe/w/The%20Artisan%20of%20Glimmith) (2026-07-30 판) | 창별 난이도 1~7 퍼즐 수, 한국어 규칙 정의, "규칙 특성상 ~가 나오지 않는다" 메모, 해금 순서와 창 복원/은/금/루비 문턱 |
| [Cheatbook](https://www.cheatbook.de/files/theartisanofglimmith.htm) | 영어 규칙 정의와 풀이 팁 |
| [camzillasmom](https://camzillasmom.com/category/the-artisan-of-glimmith/) | Solitude·Boxy·Precision 창의 퍼즐별 레벨과 동반 규칙 |
| [yekbot](https://www.yekbot.com/the-artisan-of-glimmith-walkthrough-guide/) | Non-Boxy·Inequality·Difference 창의 난이도 분포(나무위키와 교차 확인) |
| [glimmith-6ts.pages.dev](https://glimmith-6ts.pages.dev/) | Act I 312개 보드 데이터(`data/Zone1-*.js`). A급 중 **Precision만** Act I에 있음(66개). 규칙 카드 아이콘(`sprites.js`)에서 Inequality·Difference·Solitude·Boxy·Non-Boxy의 그림을 확인 |
| Steam 토론 [filler levels](https://steamcommunity.com/app/4160210/discussions/0/796714946157227832/), [hardest puzzles](https://steamcommunity.com/app/4160210/discussions/0/841753627754326289/) | GIMMICKS의 Precision·Difference 커뮤니티 인용 검증 |
| 우리 CLI (`node src/cli.ts gen`) | 이미 구현된 Precision(`range min=max`)·Solitude(`--rose 1`)의 생성 확인 |

집계 스크립트와 원본 데이터는 세션 스크래치에서만 실행했고 저장소에 넣지 않았습니다.

## 요약

| 규칙 | 원작 창(지역) | 퍼즐 수 | 난이도 1~7 분포 | 평균 | GIMMICKS 값 | 정의 | 엔진 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Precision 정밀한 넓이 | 마을 지역 첫 창 | 44 | 3·12·13·8·6·2·0 | 3.18 | 3.18 ✓ | ✓ | 있음 (`range`, min=max) + 나눗셈 추론 |
| Solitude 유일 | 숲 지역 | 37 | 6·8·10·6·4·2·1 | 3.11 | 3.11 ✓ | **△ 정정 필요** | 있음 (`solitude`, 2026-09-22 추가) |
| Boxy 사각틀 | 숲 지역 | 40 | 6·9·10·8·4·3·0 | 3.10 | 3.10 ✓ | ✓ | 있음 (`boxy`) |
| Non-Boxy 사각틀 금지 | 숲 지역 | 43 | 3·12·14·7·5·1·1 | 3.14 | 3.14 ✓ | ✓ | 있음 (`nonBoxy`) |
| Inequality 불평등 | 성 지역 | 56 | 6·11·19·11·4·3·2 | 3.23 | 3.23 ✓ | ✓ | 있음 (`inequality`) |
| Difference 넓이의 차이 | 성 지역 | 53 | 3·15·14·8·7·4·2 | 3.40 | 3.40 ✓ | ✓ (0 가능성 주의) | 있음 (`difference`, 0 허용) |

- 여섯 규칙 모두 GIMMICKS의 "전용구역 평균 난이도"가 나무위키 분포의 가중평균과 일치합니다. S급 여덟 규칙(Shape Bank 3.53, Rose 2.71, Gemini/Delta 2.59, Polyomino 2.77, Area Number 3.14, Range 3.09, Size Separation 3.13)도 같은 방법으로 다시 계산해 일치를 확인했습니다.
- 팬 사이트의 Act I Precision 창 44개 보드의 난이도 분포(3·12·13·8·6·2)도 나무위키와 정확히 같습니다. 두 자료가 독립적으로 같은 게임 데이터를 옮긴 것으로 보입니다.
- **정정이 필요한 것은 Solitude 하나**입니다. 원작의 Solitude는 "지정 기호 하나"가 아니라 **다른 규칙의 단서 타일(넓이의 수, 폴리오미노, 울타리 등)을 기호로 세어 구역마다 정확히 하나**를 요구합니다. 그래서 단독으로 나오지 않고 장미창과도 함께 나오지 않습니다. 자세한 내용은 아래.
- Difference는 원작 규칙 카드 아이콘에 **차이 0** 표식이 그려져 있습니다. 텍스트 자료에서는 0을 확인하지 못했으니 구현 시 0을 허용하되 "확인 필요"로 둡니다.

## 해금 순서와 문턱

| 창 | 해금 조건 | 창 복원 / 은 / 금 / 루비 |
| --- | --- | --- |
| 정밀한 넓이 | 도형 창고 창 복원 후 장터 지역 마지막 퍼즐 | 12 / 20 / 35 / 44 |
| 유일 | 불일치 창 복원 | 13 / 19 / 30 / 37 |
| 사각틀 | 유일 창 복원 | 13 / 20 / 32 / 40 |
| 사각틀 금지 | 유일 창 복원 | 14 / 21 / 33 / 43 |
| 불평등 | 성문 창 복원 후 마지막 퍼즐 | 15 / 26 / 41 / 56 |
| 넓이의 차이 | 불평등 창 복원 | 15 / 23 / 43 / 53 |

원작 커리큘럼에서 Precision은 두 번째 지역(마을)의 첫 창이고, Solitude → Boxy/Non-Boxy는 세 번째 지역(숲)의 후반, Inequality → Difference는 네 번째 지역(성)의 중반입니다. 나무위키는 숲 지역부터 "슬슬 까다로운 조건들이 등장"하고 성 지역은 "난이도 5 이상부터는 20~30분이 훌쩍 넘을 수도 있다"고 적습니다. GIMMICKS의 체감 난이도 순서(Precision 4.5 < Boxy 5.0 ≈ Solitude 5.0 < Non-Boxy 5.5 < Inequality 6.5 < Difference 8.5)는 이 배치 순서와 방향이 같습니다.

## 원작에서 함께 나오지 않는 조합 (나무위키 "규칙 특성상" 메모)

| 규칙 | 함께 나오지 않음 |
| --- | --- |
| Precision | 넓이의 수, 넓이의 범위(최소·최대 포함), 넓이 구분, 불평등, 넓이의 차이, (일치와 Size Separation 창 메모에서도 제외) |
| Solitude | 장미창. **단독으로도 나오지 않음** |
| Inequality, Difference | 정밀한 넓이, 일치 |
| Boxy, Non-Boxy | 메모 없음. camzillasmom의 Boxy 창 목록에는 Precision, Area Number, Mismatch, Rose, Shape Bank, Solitude, Palisade, Mingle, Polyomino, Delta, Gemini가 동반 |

성문 창(숲 지역 종합)에는 넓이의 수·울타리·일치·불일치·범위·유일·넓이 구분·사각틀·사각틀 금지가 섞여 나옵니다. 즉 A급 여섯 중 Precision을 뺀 다섯이 성문에서 종합 출제되고, Precision은 마을 지역 종합창(숲길 입구)에서 종합 출제됩니다.

우리 생성기 관점에서는 "넓이 규칙끼리 겹치지 않는다"가 원작의 일관된 원칙입니다. Precision이 있으면 Area Number/Range/Size Separation/Inequality/Difference가 없고, Inequality·Difference는 Precision·Match와 겹치지 않습니다. 웹 폼에서 Precision(`min=max`)을 고르면 다른 넓이 규칙을 끄는 것이 원작에 가깝습니다.

---

## 1. Precision — 정의 ✓, 커뮤니티 인용 ✓

**정의.** 나무위키 "모든 구역의 넓이는 제시된 숫자여야 한다", Cheatbook "Precision N means every region has exactly N cells." GIMMICKS와 같습니다.

**커뮤니티 인용 검증.** GIMMICKS가 인용한 "Precision이 작은 Shape Bank와 기능적으로 겹친다"는 Steam 스레드 "way too many filler levels"에서 확인됩니다. 원문은 OneMoreNameless의 "Precision is functionally identical to Shape Bank at lower values"이고, 다른 사용자(sine)가 "precision 1-2는 그렇지만 자유도를 미세 조정하는 차이가 있다"고 반박했으며, 개발사는 "대부분의 규칙이 비슷한 깊이를 가지고, 규칙을 조합하면 기법 수가 기하급수적으로 는다"고 답했습니다. GIMMICKS가 이 반박은 생략했다는 점만 보태면 됩니다.

**Act I 데이터 (66개 보드: Precision 창 44 + Mixed Rules 22).**

- N 분포: 4×21, 5×14, 3×10, 6×3, 9×3, 2·7·8·10·11 ×2, 13·16·18·21·60 ×1. **큰 N은 "판을 몇 조각으로 나누기" 퍼즐**입니다(120칸을 60으로 둘, 42칸을 21로 둘, 36칸을 18로 둘). 구역 수는 2~30개.
- 동반 규칙: 단독 25, Delta+Gemini 13, Rose 6, Polyomino 6, Mingle 5, Mingle+Polyomino 4, Gemini 4, Delta 2, Delta+Gemini+Rose 1.
- **단독 25개는 셀 단서가 0개**이고, 22개가 미리 그어진 경계선(벽)을, 14개가 비정형 윤곽을 씁니다. 벽 밀도는 칸당 0.26. 즉 원작 Precision 단독은 우리 "벽 모드"와 같은 방식으로 유일해를 만듭니다. 우리 CLI도 `--rules range --min 4 --max 4 --mask --walls`로 같은 형태를 0.2초에 만듭니다(6×6 2★, 8×8 N=5는 3~5★, 1.5초).
- 난이도별 평균 칸 수(단독): 1→18, 2→42, 3→36, 4→48, 5→55. 크기보다 벽 배치가 난이도를 정합니다.
- **풀이 기법.** 팬 사이트 풀이의 66개 중 62개가 `cut` 단계("이 경계선을 그으면 11칸이 잘리는데 11은 4의 배수가 아니므로 이어진다")를 쓰고, 전체 3,304단계 중 979단계가 이 나눗셈 논증입니다. 나머지는 `pieces`(N에 못 미치는 조각이 갈 곳이 하나뿐) 계열. 가정 단계(l=2)는 259, 깊은 가정(l=3)은 4에 그칩니다.

**엔진 시사점.** 우리 논리 솔버에는 이 나눗셈(가분성) 추론이 직접 기법으로 없습니다(`core.ts`의 기법은 size-full, merge-conflict, forced-exit, reach-exact, shape-place, 그리고 lookahead·bifurcation). 같은 결론을 lookahead(3등급)나 가정으로 얻으므로, Precision 퍼즐은 원작이 1등급으로 보는 단계를 우리가 3등급 이상으로 매겨 **별점이 높게 나올 가능성**이 있습니다. "어떤 엣지를 벽으로 두면 잘리는 주머니의 칸 수가 [min,max] 구역들의 합으로 표현될 수 없다 → 이음"을 1~2등급 기법으로 넣으면 Precision과 Range 모두에 맞습니다.

예시(단독, 벽 있음). `1440` 5×9, N=11, 난이도 2, 벽 5개:

```
#####
#####
#####
...#.
...#.
.####
.####
.####
.####
```

`0138` 6×6 직사각 판 36칸을 N=18로 둘로 나누는 퍼즐(난이도 3)은 벽 19개로 유일해를 만듭니다. `1441b` 12×10 직사각 120칸을 N=60으로 둘로 나누는 퍼즐(난이도 2)은 벽 45개.

---

## 2. Solitude — 정의 △ (정정 필요), 난이도 ✓

**GIMMICKS의 설명.** "모든 region에 지정 symbol이 정확히 하나씩", 예시로 `●   ●` 두 점, "Rose보다 단순한 connectivity constraint". 우리 엔진도 이 해석으로 `rose symbolCount=1`을 Solitude라 부릅니다(`types.ts`, `rose.ts`, README).

**원작.**

- 나무위키: "각 구역은 정확히 하나의 기호를 포함해야 한다. **규칙 특성상 장미창이 나오지 않으며, 단독으로 나오지 않는다.**"
- Cheatbook: "The current wording is literal: every region contains exactly one symbol." 팁: "두 기호가 같은 연결 영역에 강제되면 그 사이 어딘가에 경계가 있고, 어떤 기호에도 닿을 수 없게 된 빈 주머니는 밖으로 합쳐져야 한다."
- camzillasmom Solitude 창 퍼즐 목록의 동반 규칙: Area Number(1·7·8·9·10번 등), Polyomino(2·11·12), Palisade(4·5·13·15), Palisade+Polyomino(6·14), Polyomino+Area Number(3), Mingle+Area Number+Palisade(16), Area Number+Polyomino+Palisade(20), **Precision 4+Palisade(25)**, Mismatch. **모든 퍼즐에 다른 단서 규칙이 있습니다.**
- 팬 사이트 규칙 카드 아이콘(`ONE_SYMBOL_PER_REGION`): 한 구역에 넓이의 수 "4", 다른 구역에 마름모 기호, 또 다른 구역에 빗금 타일이 각각 하나씩 그려져 있습니다.

따라서 **원작의 Solitude는 "기호 종류를 가리지 않고, 다른 규칙의 단서 타일을 포함해 구역마다 단서가 정확히 하나"**입니다. 단독 장미 기호를 하나씩 두는 GIMMICKS의 예시는 Solitude 창의 규칙이 아니라 **기호가 한 종류뿐인 장미창**에 해당합니다. 그런 장미창은 원작 Act I에도 19개 있고(장미창 73개 중, 부록 B) 우리 `rose k=1`과 정확히 같은 규칙이므로, 우리 엔진의 "Solitude"는 이름만 바꾸면 됩니다.

**난이도.** 3.11(37개, 1~7 모두 존재, 7이 1개). Cheatbook 팁과 camzillasmom 목록으로 볼 때 어려움은 Solitude 자체가 아니라 동반 규칙(특히 Palisade)에서 옵니다. GIMMICKS의 흥미도 8.0은 원작 규칙 기준으로도 무리가 없지만, 그 근거인 "Rose보다 단순한 connectivity"는 기호 한 종류 장미창에 대한 말입니다.

**엔진 시사점.**

- 지금의 `rose k=1`은 "기호 한 종류 장미창"으로 이름을 바꾸고(웹 i18n의 Solitude 표기 포함), 원작 Solitude는 새 규칙 `solitude`로 두는 것이 맞습니다: **구역마다 셀 단서(넓이의 수·폴리오미노·장미 기호 등) 셀이 정확히 하나**. `clues.ts`가 이미 "한 셀에 기호 하나"를 지키므로 셀 단서 수 = 기호 수입니다.
- 구현은 `rose.ts`의 구조를 그대로 재사용할 수 있습니다: 단서 셀 여부를 기호 하나로 보고 k=1로 돌리면 되고, `init`의 같은-기호 벽 추론(인접한 두 단서 셀 사이는 벽)과 "닫힌 구역에 단서 없음 → 모순"이 그대로 적용됩니다.
- 생성기에는 이득이 큽니다. 넓이의 수와 함께 쓰면 "숫자 없는 구역"이 없어지고 인접 단서 셀 사이가 전부 벽이 되므로, HANDOFF 11번의 "같은 넓이 이웃 구역이 칸을 맞바꾸는" 비유일 문제가 줄어듭니다(맞바꾼 결과도 숫자 하나씩이면 여전히 가능하니 없어지지는 않음). 원작이 Solitude를 항상 Area Number/Polyomino/Palisade와 묶는 이유입니다.
- 우리 CLI 확인(6×6, seed 7): `--rules rose,areaNumber --rose 1`은 1.1초에 7★·7★·2★, `--rules rose,shapeBank --rose 1`은 0.2초에 1~2★, `--rules rose,range --rose 1 --min 3 --max 3`은 0.2초에 1~2★. 기호 한 종류 장미창으로서는 이미 잘 돕니다.

---

## 3~4. Boxy / Non-Boxy — 정의 ✓, 난이도 ✓

**정의.** 나무위키 "모든 구역은 사각형이어야 한다" / "모든 구역은 사각형이 아니어야 한다". Cheatbook "Boxy requires rectangular regions, while Non-Boxy forbids rectangles." camzillasmom "all puzzle regions have to be rectangular". GIMMICKS와 같습니다.

**분포.** Boxy 40개(6·9·10·8·4·3·0), Non-Boxy 43개(3·12·14·7·5·1·1). 나무위키 메모: Non-Boxy는 "금색 퍼즐에 난이도 5, 6도 없는데 난이도 7 퍼즐이 있다". yekbot의 Non-Boxy 43개 분포도 같습니다. 두 창 모두 유일 창 복원으로 열리고 서로 병렬입니다.

**팁.** Cheatbook Boxy: "부분적으로 L자인 구역은 다른 규칙이 막지 않는 한 결국 빠진 모서리를 채워야 한다." GIMMICKS의 `XX / X?` 예시와 같은 추론입니다. Non-Boxy에 대한 풀이 팁은 어느 출처에도 없었습니다.

**커뮤니티.** GIMMICKS는 Boxy/Non-Boxy에 커뮤니티 근거를 붙이지 않았고, 이번에 찾은 Steam 토론·리뷰에서도 두 규칙에 대한 호불호 언급은 없었습니다. 흥미도 8.0/7.5는 순수한 추정치로 보면 됩니다.

**아이콘.** 팬 사이트 규칙 카드에는 Boxy가 직사각형 구역들 위에 폴리오미노 단서(점-선 그림), Non-Boxy가 L·ㄷ자 구역 위에 폴리오미노 단서로 그려져 있습니다. 원작에서 두 규칙이 Polyomino와 자주 묶인다는 camzillasmom 목록과 맞습니다.

**엔진 시사점.** 둘 다 `Rule` 인터페이스(`rule.ts`)로 값싸게 들어갑니다.

- Boxy: `propagate`에서 각 성분의 경계 상자 안 칸을 모두 이어야 함(상자 안에 벽·구멍·다른 성분이 있으면 모순, 아니면 상자 안 엣지를 JOIN으로 밀기). `mergeConflict`는 합친 상자를 같은 기준으로 검사. `placementConflict`는 후보 칸 집합이 직사각형인지. `check`는 구역 = 자기 경계 상자. 추론이 강해서 생성 시 유일해가 쉽게 나오지만, 직사각 판을 직사각형으로 타일링하는 것은 대칭 해가 많아 셀 단서나 벽이 필요합니다.
- Non-Boxy: `check`만 강하고 전파는 약합니다. 닫혔는데 직사각형인 성분 → 모순, 넓이가 확정됐는데 직사각형만 가능한 성분 → 모순. `placementConflict`로 직사각형 후보를 버리는 것이 실질적 추론입니다. 2칸 구역(도미노)은 항상 직사각형이므로 Non-Boxy는 **모든 구역이 3칸 이상**임을 뜻합니다. 생성 시 `autoSizeBand` 하한 3과 맞습니다.

---

## 5. Inequality — 정의 ✓, 난이도 ✓

**정의.** 나무위키 "불평등 기호는 인접한 두 구역의 넓이를 비교한다", Cheatbook "Read the inequality sign as a comparison between the sizes of the two adjacent regions it separates." GIMMICKS와 같습니다.

**표시 방식.** 규칙 카드 아이콘(`INEQUALITY`)은 **두 구역 사이 경계선 위의 마름모 안에 꺾쇠(∨)**입니다. 쌍둥이/닮지 않은 둘 표식과 같은 자리(엣지 위)이고 방향이 큰 쪽을 가리킵니다. 즉 이 표식이 있는 엣지는 벽이며, 양쪽 구역의 넓이에 부등호가 걸립니다.

**커뮤니티.** GIMMICKS가 Difference 항목에서 인용한 "Inequality는 방향성이 있어 훨씬 좁혀진다"는 Steam "hardest puzzles" 스레드의 Akonyl 발언으로 확인됩니다. 같은 스레드에서 Inequality 자체를 가장 어렵다고 꼽은 사람은 없습니다.

**분포.** 56개(6·11·19·11·4·3·2). 난이도 7이 두 개 있어 A급 중 Difference와 함께 가장 위가 두껍습니다. 정밀한 넓이·일치와는 함께 나오지 않습니다.

**엔진 시사점.** `{ type: 'inequality', edge, larger: 'a' | 'b' }`로 두면 지금의 구간 경계(`comp.lo/hi`, `state.narrow`)에 정확히 맞습니다: A > B이면 `A.lo ≥ B.lo + 1`, `B.hi ≤ A.hi − 1`을 매 `propagate`마다 좁히면 GIMMICKS의 `A < B < C, C ≤ 6 → B ≤ 5 → A ≤ 4` 사슬이 자동으로 전파됩니다. 표식 엣지는 `init`에서 벽(`marker-wall`)으로. Gemini/Delta 표식과 같은 자리이므로 생성기의 표식 배치·최소화 코드(벽 모드의 `marker` 경로)를 재사용할 수 있습니다.

---

## 6. Difference — 정의 ✓(0 주의), 커뮤니티 인용 ✓, 난이도 ✓

**정의.** 나무위키 "넓이의 차이 기호는 인접한 두 구역의 넓이의 차이를 나타낸다", Cheatbook "A Difference number tells you the cell-count difference between the adjacent regions." 팁: "한쪽 넓이가 알려지면 다른 쪽 넓이는 정확해진다"(둘 중 하나로). GIMMICKS의 `|A−B| = N`과 같습니다.

**0의 존재.** 규칙 카드 아이콘(`DIFFERENCE`)에는 경계 위 마름모 안에 **3, 2, 1, 0**이 그려져 있습니다. 차이 0은 "인접한 두 구역의 넓이가 같다"이고, Size Separation의 반대 표식이 됩니다. 텍스트 출처에서는 0을 확인하지 못했으므로 구현은 0을 허용하되 실제 퍼즐 확인은 남겨둡니다(Act II·III 데이터가 팬 사이트에 올라오면 집계 가능).

**커뮤니티 인용 검증.** GIMMICKS의 두 인용은 모두 Steam "hardest puzzles" 스레드에서 확인됩니다.

- dathompson: 난이도 7의 Difference "spade" 퍼즐이 가장 오래 걸렸고, 큰 값이 들어갈 수 없다는 것을 "증명"하려다 여러 번 막혔다.
- Akonyl: "Difference는 ± 양쪽이 열려 있어 논리 사슬 끝의 숫자가 금방 불확실해지고, Inequality는 방향성이 좁혀준다." 같은 사람이 Compass와 Difference를 일반적으로 가장 어려운 유형으로 꼽았습니다.

**분포.** 53개(3·15·14·8·7·4·2), 평균 3.40으로 A급 중 최고이며 GIMMICKS 표대로 Compass(3.74)·Shape Bank(3.53) 다음입니다. 불평등 창 복원으로 열립니다.

**엔진 시사점.** `{ type: 'difference', edge, value: N }`. 한쪽이 확정(x)되면 다른 쪽은 {x−N, x+N} 두 값인데, 우리 성분 사실은 구간 하나(`lo..hi`)라 `[x−N, x+N]`으로만 좁혀지고 가운데를 배제하지 못합니다. Size Separation이 "≠ n"을 구간 양끝에서만 처리하는 것(`size.ts` 주석)과 같은 한계이며, 나머지는 `placementConflict`·`mergeConflict`에서 |a−b|=N을 직접 검사해 메웁니다. N=0이면 등식이라 구간 교집합으로 완전히 전파됩니다. 커뮤니티가 말한 "± 불확실성"이 그대로 솔버의 약한 전파로 나타나므로, 별점 상으로도 Inequality보다 높게 나올 것입니다.

---

## 구현 (2026-09-22, 검증 직후)

위 시사점은 같은 날 모두 구현했습니다. 자세한 것은 `HANDOFF.md` 13번.

- `solitude`·`boxy`·`nonBoxy`·`inequality`·`difference` 규칙(`src/engine/rules/solitude.ts`, `boxy.ts`, `compare.ts`), 생성기·CLI·웹 폼·힌트·오류 표시.
- 나눗셈 추론 `pocket-count`(`core.ts`): 비벽 엣지 그래프의 다리(bridge)를 찾아, 벽으로 두면 잘리는 주머니의 칸 수가 허용 넓이(Range 구간 ∩ Shape Bank 크기 집합 ∩ Non-Boxy 하한 3)의 합으로 표현될 수 없으면 이음. Precision(허용 넓이 하나)은 1등급, 그 외 2등급.
- 기존 `rose k=1`은 "기호 한 종류 장미창"으로 이름만 바꿨습니다(`--rose 1`).

## GIMMICKS.md에 반영할 것

1. **Solitude 정의 교체**: "모든 region에 지정 symbol이 정확히 하나씩" → "구역마다 단서 타일(넓이의 수·폴리오미노·울타리 등 어떤 규칙의 기호든)이 정확히 하나. 단독·장미창과는 나오지 않음." `●   ●` 예시는 기호 한 종류 장미창의 예시로 옮기기.
2. **Difference에 "차이 0 표식이 규칙 카드에 있음(확인 필요)"** 추가.
3. **Inequality·Difference 표식 위치**: Gemini/Delta처럼 경계 위 표식이며, 표식 엣지는 벽.
4. **Precision 단독의 유일해 방식**: 원작은 셀 단서 없이 미리 그어진 벽과 비정형 윤곽으로 만든다(Act I 단독 25개 중 벽 22, 비정형 14, 단서 0).
5. **넓이 규칙끼리 겹치지 않음**: Precision은 Area Number·Range·Size Separation·Inequality·Difference와, Inequality·Difference는 Precision·Match와 함께 나오지 않는다.
6. Precision의 Steam 인용에 반박(sine)과 개발사 답변이 있었다는 점.

## 부록 A. Act I의 Precision 보드 전체 (66)

`구역 수` = 칸 ÷ N. `벽` = 미리 그어진 경계선 수, `구멍` = 외곽 사각형에서 빠진 칸 수.

| 창 | ID | 외곽 | 칸 | N | 구역 수 | 난이도 | 벽 | 구멍 | 다른 룰 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mixed-rules | 1030 | 5×6 | 30 | 2 | 15 | 1 | 0 | 0 | Rose |
| mixed-rules | 1036 | 8×6 | 24 | 4 | 6 | 1 | 0 | 24 | Mingle |
| mixed-rules | 1250 | 6×6 | 36 | 4 | 9 | 1 | 0 | 0 | Mingle, Polyomino |
| mixed-rules | 0253 | 7×11 | 60 | 5 | 12 | 2 | 0 | 17 | Polyomino |
| mixed-rules | 1125 | 8×7 | 54 | 9 | 6 | 2 | 6 | 2 | Polyomino |
| mixed-rules | 1168 | 7×7 | 39 | 3 | 13 | 2 | 0 | 10 | Rose |
| mixed-rules | 1171 | 9×9 | 52 | 4 | 13 | 2 | 0 | 29 | Polyomino |
| mixed-rules | 0136 | 6×6 | 36 | 4 | 9 | 3 | 18 | 0 | Mingle |
| mixed-rules | 0231 | 6×5 | 30 | 10 | 3 | 3 | 0 | 0 | Rose |
| mixed-rules | 0247 | 6×5 | 30 | 3 | 10 | 3 | 0 | 0 | Polyomino |
| mixed-rules | 0249 | 12×5 | 60 | 4 | 15 | 3 | 0 | 0 | Polyomino |
| mixed-rules | 1172 | 8×8 | 40 | 5 | 8 | 3 | 16 | 24 | Mingle |
| mixed-rules | 0228 | 8×8 | 56 | 4 | 14 | 4 | 0 | 8 | Rose |
| mixed-rules | 0232 | 8×8 | 64 | 4 | 16 | 4 | 16 | 0 | Delta, Gemini, Rose |
| mixed-rules | 0248 | 10×10 | 60 | 6 | 10 | 4 | 0 | 40 | Mingle |
| mixed-rules | 0259 | 10×8 | 80 | 5 | 16 | 4 | 0 | 0 | Mingle, Polyomino |
| mixed-rules | 0695 | 8×8 | 60 | 5 | 12 | 4 | 19 | 4 | Mingle |
| mixed-rules | 0046 | 8×6 | 48 | 4 | 12 | 5 | 0 | 0 | Mingle, Polyomino |
| mixed-rules | 0229 | 8×10 | 70 | 5 | 14 | 5 | 17 | 10 | Rose |
| mixed-rules | 0230 | 9×13 | 95 | 5 | 19 | 5 | 0 | 22 | Rose |
| mixed-rules | 0252 | 12×12 | 120 | 4 | 30 | 5 | 0 | 24 | Mingle, Polyomino |
| mixed-rules | 0250 | 9×9 | 64 | 4 | 16 | 6 | 0 | 17 | Polyomino |
| region-size-x | 0070 | 3×4 | 12 | 4 | 3 | 1 | 4 | 0 |  |
| region-size-x | 0092 | 7×4 | 28 | 4 | 7 | 1 | 3 | 0 | Delta, Gemini |
| region-size-x | 0122 | 6×4 | 24 | 4 | 6 | 1 | 9 | 0 |  |
| region-size-x | 0075 | 6×8 | 42 | 7 | 6 | 2 | 5 | 6 |  |
| region-size-x | 0098 | 7×7 | 20 | 4 | 5 | 2 | 0 | 29 |  |
| region-size-x | 0112 | 6×7 | 24 | 3 | 8 | 2 | 0 | 18 |  |
| region-size-x | 0118 | 5×4 | 20 | 5 | 4 | 2 | 6 | 0 |  |
| region-size-x | 0244 | 8×5 | 27 | 3 | 9 | 2 | 0 | 13 |  |
| region-size-x | 0278 | 6×6 | 36 | 6 | 6 | 2 | 14 | 0 |  |
| region-size-x | 0782 | 6×6 | 33 | 3 | 11 | 2 | 6 | 3 | Delta, Gemini |
| region-size-x | 1416 | 7×8 | 40 | 2 | 20 | 2 | 12 | 16 |  |
| region-size-x | 1420 | 8×9 | 63 | 7 | 9 | 2 | 21 | 9 |  |
| region-size-x | 1431 | 7×7 | 33 | 11 | 3 | 2 | 3 | 16 |  |
| region-size-x | 1440 | 5×9 | 33 | 11 | 3 | 2 | 5 | 12 |  |
| region-size-x | 1441b | 12×10 | 120 | 60 | 2 | 2 | 45 | 0 |  |
| region-size-x | 0110 | 8×8 | 64 | 4 | 16 | 3 | 11 | 0 | Delta, Gemini |
| region-size-x | 0119 | 6×6 | 36 | 4 | 9 | 3 | 14 | 0 |  |
| region-size-x | 0121 | 5×5 | 25 | 5 | 5 | 3 | 12 | 0 |  |
| region-size-x | 0138 | 6×6 | 36 | 18 | 2 | 3 | 19 | 0 |  |
| region-size-x | 0156 | 6×6 | 36 | 3 | 12 | 3 | 9 | 0 |  |
| region-size-x | 0184 | 7×6 | 42 | 21 | 2 | 3 | 2 | 0 |  |
| region-size-x | 0199 | 8×8 | 64 | 4 | 16 | 3 | 23 | 0 | Delta, Gemini |
| region-size-x | 0781 | 6×5 | 26 | 13 | 2 | 3 | 3 | 4 | Gemini |
| region-size-x | 1235 | 11×8 | 60 | 5 | 12 | 3 | 14 | 28 | Delta |
| region-size-x | 1242 | 9×6 | 35 | 5 | 7 | 3 | 5 | 19 | Gemini |
| region-size-x | 1417 | 7×8 | 40 | 4 | 10 | 3 | 12 | 16 |  |
| region-size-x | 1418 | 7×8 | 40 | 5 | 8 | 3 | 12 | 16 |  |
| region-size-x | 1442 | 13×13 | 65 | 5 | 13 | 3 | 4 | 104 | Gemini |
| region-size-x | 0093 | 8×5 | 40 | 4 | 10 | 4 | 10 | 0 | Delta, Gemini |
| region-size-x | 0130 | 6×6 | 36 | 3 | 12 | 4 | 14 | 0 | Delta, Gemini |
| region-size-x | 0140 | 8×8 | 64 | 4 | 16 | 4 | 14 | 0 | Delta, Gemini |
| region-size-x | 0243 | 6×9 | 54 | 3 | 18 | 4 | 10 | 0 | Delta, Gemini |
| region-size-x | 0245 | 6×6 | 36 | 9 | 4 | 4 | 10 | 0 |  |
| region-size-x | 1128 | 9×6 | 54 | 3 | 18 | 4 | 24 | 0 | Delta, Gemini |
| region-size-x | 1421b | 12×9 | 60 | 10 | 6 | 4 | 8 | 48 |  |
| region-size-x | 1422 | 4×8 | 32 | 16 | 2 | 4 | 7 | 0 | Delta |
| region-size-x | 0246 | 10×6 | 60 | 5 | 12 | 5 | 11 | 0 | Delta, Gemini |
| region-size-x | 0255 | 6×6 | 27 | 9 | 3 | 5 | 4 | 9 | Delta, Gemini |
| region-size-x | 0257 | 11×11 | 85 | 5 | 17 | 5 | 19 | 36 |  |
| region-size-x | 1127 | 8×6 | 40 | 8 | 5 | 5 | 13 | 8 |  |
| region-size-x | 1419 | 7×8 | 40 | 8 | 5 | 5 | 12 | 16 |  |
| region-size-x | 1443 | 8×10 | 60 | 6 | 10 | 5 | 14 | 20 | Gemini |
| region-size-x | 0030 | 10×6 | 60 | 4 | 15 | 6 | 13 | 0 | Delta, Gemini |
| region-size-x | 0116 | 9×9 | 81 | 3 | 27 | 6 | 15 | 0 | Delta, Gemini |

## 부록 B. Act I의 기호 한 종류 장미창 보드 (19)

우리 엔진의 `rose symbolCount=1`과 같은 규칙. 원작 Solitude 창의 규칙과는 다릅니다(본문 2절).

| 창 | ID | 외곽 | 칸 | 기호 수 | 난이도 | 벽 | 다른 룰 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mixed-rules | 1030 | 5×6 | 30 | 15 | 1 | 0 | Precision |
| slash-pack | 0801 | 6×6 | 32 | 8 | 1 | 0 | Shape Bank |
| mixed-rules | 1168 | 7×7 | 39 | 13 | 2 | 0 | Precision |
| mixed-rules | 1270 | 6×8 | 26 | 2 | 2 | 1 | Gemini |
| slash-pack | 1274 | 6×6 | 36 | 12 | 2 | 0 | Shape Bank |
| slash-pack | 1279 | 8×6 | 48 | 6 | 2 | 0 | Shape Bank |
| mixed-rules | 1097 | 7×6 | 42 | 19 | 3 | 35 | Delta, Gemini |
| mixed-rules | 1098 | 8×9 | 56 | 4 | 3 | 2 | Gemini, Polyomino |
| mixed-rules | 1099 | 10×9 | 64 | 4 | 3 | 2 | Gemini, Polyomino |
| slash-pack | 0195 | 6×6 | 36 | 11 | 3 | 0 | Shape Bank |
| mixed-rules | 0224 | 13×9 | 110 | 13 | 4 | 0 | Polyomino |
| mixed-rules | 0228 | 8×8 | 56 | 14 | 4 | 0 | Precision |
| slash-pack | 0277 | 7×4 | 28 | 4 | 4 | 10 |  |
| mixed-rules | 0229 | 8×10 | 70 | 14 | 5 | 17 | Precision |
| mixed-rules | 0535 | 12×12 | 108 | 23 | 5 | 13 | Shape Bank, Delta, Gemini |
| mixed-rules | 1100 | 13×13 | 96 | 7 | 5 | 3 | Gemini, Polyomino |
| slash-pack | 1236 | 9×10 | 90 | 15 | 5 | 0 | Shape Bank |
| slash-pack | 1237 | 11×11 | 88 | 20 | 5 | 0 | Shape Bank |
| slash-pack | 0223 | 11×11 | 121 | 31 | 7 | 0 | Shape Bank |
