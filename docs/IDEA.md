네. **직접 만들 수 있습니다.** 그리고 말씀하신 판단이 정확합니다. 이 프로젝트의 본체는 iOS UI가 아니라 **퍼즐 엔진—특히 generator + solver + uniqueness validator + difficulty estimator**입니다.

Glimmith도 기본적으로 하나의 격자를 connected regions로 분할하고, 그 위에 여러 규칙을 겹칩니다. 실제 게임은 20종 이상의 rule type을 조합하며, 공식적으로도 모든 퍼즐이 사람이 설계한 curated puzzle임을 강조합니다. ([스팀 상점][1]) Gemini/Delta는 인접 두 region의 shape equality/inequality를 제약하고, Palisade는 셀 주변 border configuration 자체를 제약하며, Loopy는 border topology를 제약하는 식이라 결국 **하나의 공통 partition representation 위에 rule constraint를 얹는 구조**로 구현할 수 있습니다. ([camzillasmom.com][2])

제가 만든다면 구조는 이렇게 잡겠습니다.

### 1. 게임의 진짜 상태는 `색`이 아니라 `edge`

예를 들어 6×6 보드라면 각 인접 셀 사이 edge가

UNKNOWN
JOIN       // 같은 region
WALL       // 다른 region
```

중 하나입니다.

색칠은 UI 표현일 뿐이고, 실제 해답은 이 edge들의 configuration입니다.

```text
 A A | B B
 A A | B B
-----+----
 C C | D D
 C C | D D
```

JOIN을 따라 connected component를 구하면 region이 나옵니다.

이 모델이면 Glimmith의 플레이 방식처럼 **색으로 region을 표시해도 되고 border를 직접 그려도 됩니다.** 실제 Glimmith도 올바른 border partition 자체가 완성 조건으로 사용될 수 있습니다. ([스팀 커뮤니티][3])

---

### 2. 모든 룰을 공통 `Rule` 인터페이스로 만든다

예를 들면:

```ts
interface Rule {
  validatePartial(state): Validity;
  validateComplete(state): boolean;

  propagate(state): Deduction[];

  deriveClues(solution): Clue[];
}
```

그러면

```text
ExactArea(4)
AreaNumber(cell, 6)
Minimum(3)
Maximum(7)
Range(3, 6)

ShapeBank([L4, T4, S4])
Gemini(edge)
Delta(edge)

Palisade(cell, borderPattern)
Loopy(...)
```

를 독립적인 constraint module로 만들 수 있습니다.

실제로 Glimmith에서도 `Range + Area Number`, `Minimum + Gemini`, `Range + Mingle Shape + Area Number` 같은 식으로 규칙이 섞여 사용됩니다. ([camzillasmom.com][4])

이 구조를 잘 만들어두면 **21번째 새로운 룰을 추가한다고 solver 전체를 다시 만들 필요가 없습니다.**

---

## 3. 가장 중요한 건 말씀하신 Level Generator

여기서 일반적인 랜덤 생성은 하면 안 됩니다.

제가 쓰고 싶은 방식은 **solution-first generation**입니다.

```text
① 완성된 region partition 생성
         ↓
② 그 정답에서 사용 가능한 clue들을 모두 계산
         ↓
③ clue를 많이 넣은 puzzle 생성
         ↓
④ solver 실행
         ↓
⑤ clue 하나 제거
         ↓
⑥ 여전히 unique solution인가?
      YES → 제거 유지
      NO  → clue 복원
         ↓
⑦ logical solver로 난이도 평가
         ↓
⑧ 목표 난이도가 될 때까지 반복
```

예를 들어 generator가 먼저

```text
A A B B B
A C C D B
A C D D B
E C C D F
E E E F F
```

라는 정답을 만들었다고 합시다.

그러면 자동으로 계산할 수 있습니다.

```text
A area = 4
B area = 6
C area = 5
D area = 4
E area = 4
F area = 3

shape(A) == shape(D)?
shape(A) != shape(C)?

A-B boundary → Delta 사용 가능?
A-D → Gemini 사용 가능?

전체 area range = 3–6
```

그리고 이 정답에 맞는 clue 후보를 수십 개 생성합니다.

여기에서 일부만 남깁니다.

**이 방식이 핵심입니다.**

왜냐하면 애초에 solution을 먼저 만들기 때문에 최소한 하나의 정답은 무조건 존재합니다.

---

# 4. `unique solution` 검증기가 두 번째 핵심

여기에는 두 종류의 solver가 필요합니다.

### Solver A — 완전 탐색 solver

목적은 오직:

> **해답이 정확히 하나인가?**

입니다.

```text
solve()
→ solution #1

solution #1 금지 조건 추가

solve()
→ solution #2?
```

두 번째 해답이 없다면:

```text
UNIQUE
```

입니다.

이 solver는 사람이 풀 듯 할 필요가 없습니다.

SAT/constraint search/DFS 등을 마음껏 써도 됩니다.

---

### Solver B — Human-style logical solver

이게 더 재미있는 부분입니다.

Glimmith의 좋은 퍼즐은 단순히 unique인 게 아니라 **찍지 않고 deduction chain으로 풀립니다.** 커뮤니티에서도 이런 식으로 Gemini/Delta에서 한 셀이 확장됐을 때 생기는 모순을 추적해 푸는 예가 확인됩니다. ([스팀 커뮤니티][5])

따라서 solver에게 reasoning primitive를 줍니다.

예:

```text
Forced Join
Forced Wall

Area Completion
Area Overflow

Connectivity Cut
Dead Region

Shape Impossible
Shape Forced

Gemini Propagation
Delta Elimination

Range Saturation

Palisade Edge Completion
```

그리고 실제 해결 과정:

```text
Step 1  Area Number          +1
Step 2  Connectivity         +2
Step 3  Shape elimination    +3
Step 4  Gemini propagation   +4
Step 5  Contradiction        +6
...
```

을 기록합니다.

그러면 난이도를 아주 자연스럽게 계산할 수 있습니다.

---

# 5. 난이도 자동 분류도 가능

예를 들어:

```text
Difficulty =
    0.4 × deduction count
  + 1.0 × maximum deduction tier
  + 0.6 × dependency depth
  + 1.5 × contradiction depth
```

그 결과

```text
★       tutorial
★★      easy
★★★     medium
★★★★    hard
★★★★★   expert
★★★★★★  brutal
```

처럼 만들 수 있습니다.

단순히 **solver가 몇 ms 걸렸느냐**로 난이도를 정하면 안 됩니다.

컴퓨터가 어려워하는 것과 사람이 어려워하는 것은 다릅니다.

**논리 deduction sequence 자체를 기록해야 합니다.**

---

# 6. 이걸 만들면 사실 레벨 수는 더 이상 문제가 아닙니다

예를 들어 우리가 initially 다음 7개만 구현해도 됩니다.

1. Exact Area / Precision
2. Area Number
3. Min / Max / Range
4. Shape Bank
5. Gemini
6. Delta
7. Polyomino constraints

이 정도만 있어도

```text
Area + Delta
Area + Gemini
ShapeBank + Delta
ShapeBank + Gemini
Area + ShapeBank
Range + Gemini + Delta
AreaNumber + ShapeBank + Delta
...
```

조합이 폭발합니다.

**20개 rule을 처음부터 다 만들 필요가 없습니다.**

저라면 여기까지를 **Puzzle Engine v1**으로 잡겠습니다.

그 다음

```text
Palisade
Loopy
Mingle Shape
Rose Window
...
```

처럼 topology 관련 규칙을 추가합니다.

---

# 7. 재미없는 procedural puzzle 문제도 해결할 수 있음

여기가 특히 중요합니다.

자동 생성기가 있다고 해서 재미있는 퍼즐이 나오는 것은 아닙니다.

그래서 generation pipeline에 **quality filter**가 하나 더 필요합니다.

```text
generate 10,000
       ↓
unique             3,000
       ↓
no guessing          800
       ↓
target difficulty     300
       ↓
interesting logic      80
```

예를 들어 다음은 버립니다.

```text
첫 수가 지나치게 명백함
같은 deduction만 20회 반복
독립된 두 퍼즐이 붙어 있음
대칭 때문에 풀이가 기계적
마지막 10칸이 자동으로 채워짐
불필요한 clue가 존재함
```

반대로 높은 점수를 줍니다.

```text
한 clue가 다른 rule과 interaction
Gemini → Area → Delta 연쇄
초반 선택이 후반 constraint로 되돌아옴
두 개의 서로 다른 deduction이 한 셀에서 만남
```

이 **interestingness evaluator**가 만들어지면 정말 강력합니다.

---

# 8. iPhone 구현은 오히려 쉬운 쪽

저라면 처음부터 Swift로 안 만듭니다.

```text
TypeScript
+ Canvas
+ Vite
+ PWA
+ Web Worker
```

로 만듭니다.

그러면 iPhone Safari에서

**홈 화면에 추가**

해서 거의 앱처럼 실행할 수 있습니다.

그리고 generator/solver는 Web Worker에서 돌립니다.

성능이 부족해지면 solver만

```text
Rust → WASM
```

으로 바꾸면 됩니다.

나중에 App Store에 올리고 싶으면 Capacitor로 감싸거나 Swift UI shell을 붙이면 됩니다.

즉 **iOS는 가장 나중 문제**입니다.

---

## 제가 보기엔 프로젝트 순서를 이렇게 잡는 게 맞습니다.

```text
           Puzzle Engine
                │
      ┌─────────┴─────────┐
      ↓                   ↓
    Solver             Generator
      │                   │
      ↓                   ↓
Uniqueness          Solution-first
      │                   │
      └─────────┬─────────┘
                ↓
          Logical Solver
                ↓
        Difficulty / Quality
                ↓
             Game UI
                ↓
              PWA
```

그리고 **첫 번째 목표를 게임으로 잡지 않는 게 좋습니다.**

첫 번째로 만들어야 하는 것은 이런 **Puzzle Laboratory**입니다.

```text
┌──────────────────────────────┐
│  Generator                   │
│                              │
│ Grid     6 × 6               │
│ Regions  6                   │
│ Rules                        │
│ ☑ Area Number               │
│ ☑ Gemini                    │
│ ☑ Delta                     │
│ ☐ Shape Bank                │
│                              │
│ [ Generate ]                 │
├──────────────────────────────┤
│       generated puzzle       │
│                              │
│          ▦▦▦▦▦              │
│          ▦▦▦▦▦              │
│                              │
├──────────────────────────────┤
│ Solutions: 1 ✓               │
│ Logical solve: YES ✓         │
│ Difficulty: 4.2 / 7          │
│ Deductions: 19               │
│                              │
│ [Solve] [Explain] [Export]   │
└──────────────────────────────┘
```

여기서 **Generate를 1000번 돌려보고 정말 재미있는 퍼즐이 나오는지** 확인한 다음에야 게임을 씌우는 겁니다.

### 그래서 제 결론

**충분히 만들 수 있습니다.** 그리고 단순히 Glimmith 비슷한 레벨 50개를 제가 손으로 만드는 것보다, **Glimmith류 퍼즐 자체를 생산할 수 있는 constraint engine을 먼저 만드는 게 훨씬 좋은 프로젝트**입니다.

더 중요한 건 제가 이 부분을 실제로 구현하면서 **generator가 만든 퍼즐을 solver로 수천 번 풀어보고 `0 solutions / 1 solution / multiple solutions`를 자동 검증하는 테스트까지 만들 수 있다는 것**입니다.

제가 시작한다면 **첫 버전은 5×5~7×7 + Area Number + Exact Area + Gemini + Delta**만 넣겠습니다. 이 네 개만으로 `solution generator → uniqueness solver → clue minimizer → playable web board`까지 한 번 완주해서 **“자동으로 생성된 퍼즐이 실제로 재밌는가”를 먼저 증명**하겠습니다. 그게 성공하면 Shape Bank를 붙이는 순서가 가장 안전합니다.

[1]: https://store.steampowered.com/app/4160300/The_Artisan_of_Glimmith_Demo/?utm_source=chatgpt.com "The Artisan of Glimmith Demo on Steam"
[2]: https://camzillasmom.com/the-artisan-of-glimmith-window-3-watermill-puzzle-solutions/?utm_source=chatgpt.com "The Artisan of Glimmith: Window 3 – Watermill Puzzle Solutions"
[3]: https://steamcommunity.com/app/4160210/discussions/0/840628302850875589/?utm_source=chatgpt.com "Potential minor bug - when applying a border, puzzle kind of solves itself prematurely :: The Artisan of Glimmith General Discussions"
[4]: https://camzillasmom.com/the-artisan-of-glimmith-range-window-puzzle-solutions/?utm_source=chatgpt.com "The Artisan of Glimmith: Range Window Puzzle Solutions"
[5]: https://steamcommunity.com/app/4160210/discussions/0/796714229048654763/?l=italian&utm_source=chatgpt.com "I'm stuck--please help! :: The Artisan of Glimmith Discussioni generali"
