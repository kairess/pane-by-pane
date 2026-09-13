네. 이건 게임을 직접 만들 생각이라면 꽤 중요한 조사입니다. 확인해보니 **Glimmith의 실질적인 추가 룰은 24개**로 정리하는 게 가장 자연스럽습니다. 개발사도 공식적으로 “20개가 넘는 서로 다른 rules”라고 표현합니다. `Gemini/Delta`, `Minimum/Maximum/Range`를 묶어 세느냐 나눠 세느냐에 따라 숫자가 달라집니다. ([스팀 커뮤니티][1])

또 하나 흥미로운 사실은 현재 본편이 **1,225개의 퍼즐**이고, 난이도를 1~7로 나눈다는 점입니다. 각 룰 전용 Window의 난이도별 퍼즐 수도 알려져 있어서, 단순 인상뿐 아니라 실제 분포로도 룰의 난이도를 비교할 수 있습니다. ([나무위키][2])

제가 아래에서 쓴 **난이도 10점**은 `전용 Window의 실제 난이도 분포 + 플레이어가 막힌다는 보고 + 개발사의 튜토리얼 수정 여부`를 합쳐 평가했습니다. **흥미도 10점**은 공식 통계가 아니라 `Steam/Reddit의 호불호 + deduction의 다양성 + 다른 룰과 결합했을 때의 재미`를 제가 종합한 점수입니다. 커뮤니티 표본이 충분하지 않은 룰은 너무 정밀한 숫자로 받아들이면 안 됩니다.

## 전체 24개 룰

| 순서 | 룰                         | 핵심 조건                              | 전용구역 평균 난이도¹ | 체감 난이도 /10 |   흥미도 /10 |
| -- | ------------------------- | ---------------------------------- | -----------: | ---------: | --------: |
| 1  | **Shape Bank** 도형 창고      | 제시된 shape들만 region으로 사용            |   **3.53/7** |    **6.0** |   **9.0** |
| 2  | **Rose Windows** 장미창      | 각 region이 필요한 symbol set을 하나씩 포함   |         2.71 |        4.5 |   **8.5** |
| 3  | **Gemini** 쌍둥이            | 표시 양쪽 region이 **같은 모양**            |        2.59² |        5.0 |   **9.0** |
| 4  | **Delta** 닮지 않은 둘         | 표시 양쪽 region이 **다른 모양**            |        2.59² |        5.5 |   **8.5** |
| 5  | **Precision** 정밀한 넓이      | 모든 region의 넓이가 정확히 N               |         3.18 |        4.5 |       7.5 |
| 6  | **Polyomino** 폴리오미노       | clue가 있는 region의 모양이 제시된 polyomino |         2.77 |        5.0 |   **8.5** |
| 7  | **Mingle Shape** 어우러진 모양  | 인접 region끼리는 같은 shape 금지           |         3.17 |        5.5 |       7.5 |
| 8  | **Area Number** 넓이의 수     | clue가 포함된 region의 넓이가 해당 숫자        |         3.14 |        5.0 |   **8.5** |
| 9  | **Palisade** 울타리          | clue 주변 네 edge의 border 형태를 지정      |         3.12 |    **7.5** |   **8.0** |
| 10 | **Match** 일치              | 모든 region이 같은 shape                |         3.18 |    **8.0** |   **4.5** |
| 11 | **Mismatch** 불일치          | 모든 region이 서로 다른 shape             |         3.38 |    **7.0** |   **6.0** |
| 12 | **Minimum** 최소 넓이         | 모든 region ≥ N                      |        3.09² |        4.5 |       7.0 |
| 13 | **Maximum** 최대 넓이         | 모든 region ≤ N                      |        3.09² |        4.5 |       7.0 |
| 14 | **Range** 넓이 범위           | N ≤ 모든 region ≤ M                  |        3.09² |        5.0 |   **8.0** |
| 15 | **Solitude** 유일           | 모든 region에 symbol이 정확히 하나          |         3.11 |        5.0 |   **8.0** |
| 16 | **Size Separation** 넓이 구분 | 인접 region은 같은 넓이를 가질 수 없음          |         3.13 |        6.0 |   **8.5** |
| 17 | **Boxy** 사각틀              | 모든 region이 직사각형                    |         3.10 |        5.0 |   **8.0** |
| 18 | **Non-Boxy** 사각틀 금지       | 어떤 region도 직사각형이면 안 됨              |         3.14 |        5.5 |       7.5 |
| 19 | **Bricky** 벽돌 무늬          | 한 vertex에 border 4개가 만나면 안 됨       |         3.26 |    **7.5** |     7.0 ⚡ |
| 20 | **Loopy** 질긴 고리           | vertex에서 border 1개/3개가 만나는 상태 금지   |         3.07 |    **9.0** | **7.0 ⚡** |
| 21 | **Inequality** 불평등        | 인접한 두 region의 넓이를 `<`, `>`로 비교     |         3.23 |        6.5 |   **8.0** |
| 22 | **Difference** 넓이의 차이     | 인접 region 넓이 차이가 정확히 N             |     **3.40** |    **8.5** |   **8.0** |
| 23 | **Watchtower** 감시탑        | 표시 vertex 주위에 지정 수의 region이 존재     |         3.15 |        6.5 |   **8.0** |
| 24 | **Compass** 나침반           | clue region이 상하좌우로 뻗는 cell 수 지정    |     **3.74** |    **9.0** |       6.5 |

¹ 평균은 각 룰 전용 Window에 배치된 난이도 1~7 퍼즐 수로 제가 가중평균한 것입니다. **그 Window의 퍼즐에는 다른 룰도 섞이므로 “순수 룰 자체 난이도”와 동일하지는 않습니다.** 원본 난이도별 분포는 현재 진행도 자료에 나와 있습니다. ([나무위키][2])
² Gemini/Delta는 하나의 Window, Minimum/Maximum/Range도 하나의 Window이므로 같은 평균을 사용했습니다.

### 1. Shape Bank — 9.0/10

이게 저는 **Glimmith의 가장 중요한 foundation rule**이라고 봅니다.

주어진 shape bank가

`I4 / L4 / T4`

라면 모든 영역이 이 중 하나여야 합니다. 회전·반사는 동일 shape으로 취급합니다. ([Cheatbook][3])

좋은 이유는 단독으로도 퍼즐이 되고,

**Shape Bank + Rose**

**Shape Bank + Gemini**

**Shape Bank + Area Number**

처럼 다른 룰을 붙이면 constraint propagation이 급격히 강해진다는 겁니다.

우리 게임을 만든다면 **무조건 넣어야 하는 핵심 룰**입니다.

---

### 2. Rose Windows — 8.5/10

예를 들어 ○와 △가 있다면 **각 region이 ○와 △를 각각 하나씩 포함해야 하는 식**입니다. 그래서 같은 symbol끼리는 같은 영역이 될 수 없고, 누락된 symbol을 찾아 region을 확장하게 됩니다. ([Cheatbook][3])

굉장히 좋은 룰입니다.

특히

> region의 정확한 모양을 직접 알려주지 않으면서 connectivity를 강제한다.

는 점이 generator 입장에서도 훌륭합니다.

---

### 3~4. Gemini / Delta — 9.0 / 8.5

둘은 국소적인 shape comparison입니다.

**Gemini**
→ 경계 양쪽 region이 같은 shape

**Delta**
→ 경계 양쪽 region이 다른 shape

입니다. 회전/반사된 shape도 동일 shape으로 봅니다. ([Cheatbook][3])

제가 만드는 게임이라면 **가장 먼저 구현할 기믹 중 하나**입니다.

이유는 단순합니다.

```text
Area Number
   ↓
한 region 크기 확정
   ↓
Gemini
   ↓
다른 region 모양 확정
   ↓
Shape Bank
   ↓
세 번째 region 후보 제거
```

같은 **rule chaining**이 아주 자연스럽게 발생합니다.

---

### 5. Precision — 7.5/10

모든 region의 cell 수가 정확히 N.

가장 전형적인

> partition into equal-sized connected regions

입니다.

규칙이 극도로 명확해서 튜토리얼용으로 훌륭하고 generator도 쉽습니다.

반대로 일부 플레이어는 **Precision이 작은 Shape Bank와 기능적으로 겹치고 초기 퍼즐이 반복적으로 느껴진다**고 지적하기도 했습니다. ([스팀 커뮤니티][4])

그래서 재미의 최고점은 낮지만 **게임 설계상 필수적인 glue rule**입니다.

---

### 6. Polyomino — 8.5/10

특정 cell의 아이콘이 그 region의 shape 자체입니다. ([Cheatbook][3])

이것도 상당히 좋습니다.

왜냐하면

```text
clue
  ↓
candidate placement 4개
  ↓
다른 constraint
  ↓
2개 제거
  ↓
shape 확정
```

이라는 매우 명확한 deduction을 만들 수 있기 때문입니다.

**자동 generator에도 아주 적합합니다.**

---

### 7. Mingle Shape — 7.5/10

모든 **인접 region은 서로 다른 모양**이어야 합니다. Delta가 특정 두 region에만 적용된다면 Mingle은 전역 constraint입니다. ([Cheatbook][3])

재미는 괜찮지만 문제가 있습니다.

일부 플레이어는 이것을

> “Delta를 전체 보드에 적용한 것 같다”

고 느끼고, 어려운 문제에서는 shape 후보를 하나씩 시험하는 느낌이 난다고 평가합니다. Mismatch에서도 비슷한 문제가 더 심하게 나타납니다. ([스팀 커뮤니티][4])

그래서 저는 **Delta보다 아래**로 둡니다.

---

### 8. Area Number — 8.5/10

개별 clue가 자신이 속한 region의 정확한 area를 지정합니다. Precision과 달리 region마다 크기가 달라도 됩니다. ([Cheatbook][3])

예를 들어

```text
  4        7
```

두 숫자가 각각 다른 region에 들어가면

```text
region A = 4
region B = 7
```

입니다.

단순하면서도 다른 거의 모든 rule과 결합됩니다.

**generator 관점에서도 최고의 constraint 중 하나**입니다.

---

## 여기서부터 게임이 확 어려워집니다.

### 9. Palisade — 난이도 7.5 / 흥미 8.0

이건 cell이 아니라 **cell 주변 edge pattern**을 봅니다.

아이콘이

```text
 ┌
```

처럼 되어 있으면 그 cell 주변 border가 그 형태가 되어야 합니다. ([Cheatbook][3])

이 룰에서 플레이어 반응이 재미있습니다.

개발자도 **Palisade를 가르치는 것이 특히 어려워 튜토리얼을 약 5번 다시 만들었다**고 밝혔고, “이전 200개 퍼즐과 완전히 다른 식으로 생각해야 했다”는 플레이어도 있습니다. 반대로 Reddit에는 초기에 싫어했다가 **나중에는 favorite mechanic 중 하나가 됐다**는 반응도 있습니다. ([스팀 커뮤니티][5])

즉:

> **learning cliff는 크지만, 이해 후 만족도는 높은 룰.**

우리 게임에서도 가치가 높습니다. 다만 **v1보다는 v2**가 적당합니다.

---

### 10. Match — 난이도 8.0 / 흥미 4.5

모든 region이 회전/반사를 허용해 **동일 shape**이어야 합니다. ([Cheatbook][3])

이건 커뮤니티 반응이 꽤 좋지 않습니다.

Steam에는

> 가능성을 논리적으로 하나씩 줄인다기보다 combination lock을 brute-force하는 느낌

이라는 평가가 있고, 다른 논의에서도 **“Match puzzles are awful”**, “Match와 Compass가 가장 싫다”는 반응이 나옵니다. ([스팀 커뮤니티][6])

고난도 Match + Rose 문제는 게임 전체에서 가장 어려웠다는 완주자도 있습니다. ([스팀 커뮤니티][7])

**우리 게임이라면 굳이 초기에 넣지 않겠습니다.**

---

### 11. Mismatch — 7.0 / 6.0

모든 region의 shape가 서로 달라야 합니다. ([camzillasmom.com][8])

아이디어는 좋은데 큰 board가 되면

```text
가능 shape A
가능 shape B
가능 shape C
...
```

를 머릿속에서 관리해야 합니다.

Steam에서도 **paper cutout까지 만들어가며 풀었지만 frustrating했다**, 단독 Mismatch는 brute-force 느낌이 난다는 토론이 있습니다. 다른 rule, 특히 Palisade와 섞으면 재미있어진다는 평가도 있습니다. ([스팀 커뮤니티][9])

따라서:

> **단독 사용은 약하고 combination rule로는 좋음.**

---

### 12~14. Minimum / Maximum / Range — 7~8점

각각

```text
Minimum 4 → area ≥ 4
Maximum 6 → area ≤ 6
Range 3–5 → 3 ≤ area ≤ 5
```

입니다. ([camzillasmom.com][10])

Precision보다 constraint가 느슨하기 때문에 **단독 deduction은 약하지만 다른 rule을 증폭시키는 능력**이 뛰어납니다.

특히 Range는 좋습니다.

```text
Range 4–6
+
Size Separation
+
Area Number
```

같은 조합에서 상당히 재미있는 계산 문제가 됩니다.

우리 게임에는 세 개 모두 구현하되 **하나의 `AreaConstraint` 시스템**으로 만들면 됩니다.

---

### 15. Solitude — 8.0

모든 region에 지정 symbol이 **정확히 하나씩** 있어야 합니다. ([Cheatbook][3])

Rose보다 단순하지만 아주 좋은 connectivity constraint입니다.

```text
●       ●
```

두 ●가 같은 영역이 될 수 없다는 것만으로 border가 생기고, symbol이 없는 고립 pocket은 다른 영역과 merge되어야 합니다.

깔끔합니다.

---

### 16. Size Separation — 8.5

**인접 region은 동일 area를 가질 수 없습니다.** ([Cheatbook][3])

이 규칙의 장점은 다른 size rule과의 interaction입니다.

예를 들어:

```text
Range 3–5
```

인 상황에서 한 영역이 4라고 확정되면 그 이웃은 자동으로

```text
3 or 5
```

가 됩니다.

Area Number, Range, Difference, Inequality와 연결하면 propagation network가 만들어집니다.

**우리가 만들 게임에는 반드시 넣고 싶습니다.**

---

### 17~18. Boxy / Non-Boxy — 8.0 / 7.5

Boxy:

> 모든 region이 rectangle.

Non-Boxy:

> rectangle인 region이 하나도 없어야 함.

입니다. ([Cheatbook][3])

Boxy에서는

```text
XX
X?
```

가 같은 영역이라면 `?`도 들어가야 하는 식의 강력한 geometry deduction이 생깁니다.

**사람에게 직관적이고 solver에도 구현하기 쉽습니다.**

좋은 룰입니다.

---

## 후반 6종은 성격이 완전히 달라집니다.

### 19. Bricky — 난이도 7.5 / 흥미 7.0 ⚡

**하나의 grid vertex에 border 4개가 동시에 만나면 안 됩니다.** ([나무위키][2])

즉

```text
 ─┼─
  │
```

식으로 네 영역의 corner가 한 점에서 만나는 구조를 금지합니다.

흥미로운 deduction은 많지만 **cell/region이 아니라 vertex topology를 생각해야 해서 사고 방식이 전환**됩니다.

실제로 한 플레이어는 Bricky와 Loopy를 favorite으로 꼽았지만 다른 플레이어는 둘을 “shock collars”에 비유할 정도로 싫어했습니다. ([스팀 커뮤니티][11])

그래서 ⚡ = **호불호 큼**입니다.

---

### 20. Loopy — 난이도 9.0 / 흥미 7.0 ⚡⚡⚡

가장 문제적이고 동시에 가장 흥미로운 룰입니다.

Loopy에서는 한 vertex에

```text
border 1개 ❌
border 3개 ❌

0개 ✓
2개 ✓
4개 ✓
```

만 가능합니다. 결과적으로 border가 dangling end나 T-junction을 만들 수 없고, 폐곡선/inside-outside topology가 생깁니다. ([Cheatbook][3])

여기에는 심지어 **2-color parity deduction**까지 존재합니다.

밖에서 시작해서 border를 건널 때마다 parity를 뒤집으면

```text
Blue — wall — Red — wall — Blue
```

와 같은 관계가 생기고, 같은 parity가 인접하면 join, 다른 parity면 wall을 강제할 수 있습니다. ([Cheatbook][3])

그리고 이건 커뮤니티 자료가 아주 명확합니다.

개발사가 2026년 8월 직접 밝혔습니다.

**Loopy는 Steam 리뷰에서 다른 어떤 rule보다 2배 이상 많은 불만을 받았습니다.** 또한 Bricky→Loopy achievement 사이의 이탈도 다른 progression보다 컸습니다.

그런데 동시에 **Loopy를 최고의 rule 중 하나로 꼽는 tier list도 많이 있었다**고 합니다. 그래서 개발사가 플레이 영상들을 분석하고 튜토리얼을 아예 다시 만들었습니다. ([SteamDB][12])

즉 이건:

> **잘 가르치면 S-tier, 잘못 가르치면 게임 삭제하게 만드는 룰.**

입니다.

우리 게임에서는 아주 나중에 넣는 게 맞습니다.

---

### 21. Inequality — 8.0

두 인접 region의 area에

```text
A < B
```

관계를 겁니다. ([Cheatbook][3])

좋은 이유는 constraint propagation입니다.

```text
A < B < C

C ≤ 6

→ B ≤ 5
→ A ≤ 4
```

처럼 chain reasoning이 가능합니다.

**SAT/CSP solver로도 매우 예쁘게 표현되는 규칙**입니다.

---

### 22. Difference — 난이도 8.5 / 흥미 8.0

인접 두 region의 area 차이가 정확히 N.

```text
|A-B| = 2
```

입니다. ([Cheatbook][3])

Difficulty 7의 Difference를 가장 어려운 문제 중 하나로 꼽은 완주자가 있고, 다른 플레이어도 **Difference는 ± 양쪽 가능성이 열려 있어 possibility space가 빠르게 커진다**고 분석했습니다. 반면 Inequality는 방향성이 있기 때문에 훨씬 좁혀진다는 평가입니다. ([스팀 커뮤니티][7])

이건 우리 generator 관점에서 굉장히 좋은 기믹입니다.

---

### 23. Watchtower — 8.0

여기 자료에 약간 표현 차이가 있는데, 핵심은 **특정 vertex 주변 region topology를 제한**하는 것입니다. 게임 진행 자료에서는 눈의 개수만큼 주변 region이 있어야 한다고 설명합니다. ([나무위키][2])

Bricky/Loopy 계열처럼 vertex를 보지만 rule이 더 국소적입니다.

그래서

**Palisade → Watchtower → Bricky → Loopy**

순서로 topology reasoning을 가르치는 것이 좋아 보입니다.

---

### 24. Compass — 난이도 9.0 / 흥미 6.5

Compass clue는 자신의 region이 북/남/동/서 방향으로 몇 칸 뻗는지를 나타냅니다. 빈 방향은 0을 의미하는 것은 아닙니다. ([Cheatbook][3])

전용 window의 평균 난이도가 **3.74/7로 전체 rule window 중 가장 높습니다.** 66개 중 18개가 난이도 5~7이고, 난이도 7도 3개입니다. ([나무위키][2])

개발자도 Compass가 어렵다는 사실을 인정하고 긴 tutorial sequence를 사용했다고 설명했습니다. 완주자 토론에서도 **Compass와 Difference가 일반적으로 가장 어려운 puzzle type**이라는 평가가 있습니다. ([스팀 커뮤니티][13])

그리고 Match와 함께 least favorite이라는 사용자 평가도 보입니다. ([Reddit][14])

그래서 상당히 깊지만 모바일 casual용으로는 조심해야 합니다.

---

## 이걸 게임 개발 관점에서 다시 보면 순위가 달라집니다

제가 **우리가 만들 Glimmith 계열 게임**에 넣을 룰을 고른다면 24개를 그대로 복사하지 않을 겁니다.

가장 가치가 높은 핵심은:

**S급**
`Shape Bank · Gemini · Delta · Rose · Area Number · Polyomino · Range · Size Separation`

입니다.

이 8개는 **규칙 설명이 짧고, 서로 조합했을 때 새로운 deduction이 많이 발생하며, generator/solver로 표현하기도 좋습니다.**

그 다음 **A급**은:

`Precision · Solitude · Boxy · Non-Boxy · Inequality · Difference`

입니다.

그리고 **후반 확장팩급**으로:

`Palisade · Watchtower · Bricky · Loopy · Compass`

를 두는 게 좋겠습니다.

반대로 저는 **Match와 Mismatch는 우선순위를 상당히 낮추겠습니다.** 실제 사용자 불만도 있고, 우리가 자동 생성기를 만들 경우 잘못 생성된 Match/Mismatch 문제는 **논리 퍼즐이라기보다 후보 shape를 하나씩 시험하는 search puzzle**이 되기 쉽기 때문입니다. ([스팀 커뮤니티][6])

가장 중요한 발견은 **Glimmith의 재미가 “24가지 룰” 자체에서 나오는 게 아니라 룰 간 interaction에서 나온다는 것**입니다. 개발사도 개별 룰 하나에도 수십 가지 technique가 있고, 여러 룰을 조합하면 가능한 trick의 수가 기하급수적으로 증가한다고 설명합니다. ([스팀 커뮤니티][4])

그래서 다음 단계에서는 이 24개를 **`solver 구현 난이도 × generator 구현 난이도 × 유일해 검증 난이도 × 재미`의 4축으로 다시 점수화**하는 게 좋겠습니다. 그렇게 하면 **우리 게임 v1에 넣을 8~10개 룰을 정확히 결정할 수 있습니다.** 이 분석은 실제 구현 아키텍처를 정하는 데 훨씬 중요합니다.

[1]: https://steamcommunity.com/app/4160210/announcements/?utm_source=chatgpt.com "Steam Community :: The Artisan of Glimmith"
[2]: https://namu.moe/w/The%20Artisan%20of%20Glimmith "The Artisan of Glimmith"
[3]: https://www.cheatbook.de/files/theartisanofglimmith.htm "The Artisan of Glimmith Cheats, Tips and Puzzle Solutions"
[4]: https://steamcommunity.com/app/4160210/discussions/0/796714946157227832/?utm_source=chatgpt.com "way too many filler levels :: The Artisan of Glimmith General Discussions"
[5]: https://steamcommunity.com/app/4160210/discussions/0/796712966523262788/?l=brazilian&utm_source=chatgpt.com "Palisade rule confusion :: The Artisan of Glimmith Discussões gerais"
[6]: https://steamcommunity.com/app/4160210/discussions/0/796714229048801194/?l=french&utm_source=chatgpt.com "'Match' constraint logical solve process? :: The Artisan of Glimmith Discussions générales"
[7]: https://steamcommunity.com/app/4160210/discussions/0/841753627754326289/?l=italian&utm_source=chatgpt.com "The hardest puzzles :: The Artisan of Glimmith Discussioni generali"
[8]: https://camzillasmom.com/the-artisan-of-glimmith-mismatch-window-puzzle-solutions/?utm_source=chatgpt.com "The Artisan of Glimmith: Mismatch Window Puzzle Solutions"
[9]: https://steamcommunity.com/app/4160210/discussions/0/796713273232896579/?utm_source=chatgpt.com "Anyone else finding themselves having to brute force most of the \"Mismatch\" puzzles? :: The Artisan of Glimmith General Discussions"
[10]: https://camzillasmom.com/the-artisan-of-glimmith-range-window-puzzle-solutions/?utm_source=chatgpt.com "The Artisan of Glimmith: Range Window Puzzle Solutions"
[11]: https://steamcommunity.com/app/4160210/discussions/0/796716542888934780/?utm_source=chatgpt.com "Please remove \"Loopy\" from the game :: The Artisan of Glimmith General Discussions"
[12]: https://steamdb.info/patchnotes/24881186/?utm_source=chatgpt.com "Glimmith Optimization, Quality, and Tutorial Update · The Artisan of Glimmith update for 22 August 2026 · SteamDB"
[13]: https://steamcommunity.com/app/4160210/eventcomments/841753826210875249?snr=2_groupannouncements_detail_&utm_source=chatgpt.com "Glimmith Update! Trading cards, music player, puzzle IDs, new demo, and more... :: The Artisan of Glimmith Events & Announcements"
[14]: https://www.reddit.com/r/puzzlevideogames/comments/1trmz2x/artisan_of_glimmith_how_do_yall_feel_about/?utm_source=chatgpt.com "Artisan of Glimmith: how do y'all feel about uniqueness and bifurcation strategies?"
