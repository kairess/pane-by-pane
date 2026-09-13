# 원작 Shape Bank 도형 조사

출처: [glimmith-6ts.pages.dev](https://glimmith-6ts.pages.dev/) — The Artisan of Glimmith Act I(Cozy Hamlet) 312개 보드를 단계별로 풀어놓은 팬 사이트의 보드 데이터(`data/Zone1-*.js`)를 집계했습니다. Act II·III는 아직 그 사이트에 없으므로 **Act I 기준**입니다(전체 1,225 퍼즐 중 312).
집계 스크립트는 세션 스크래치에서 실행했고 원본 데이터는 저장소에 넣지 않았습니다.

- Shape Bank가 있는 퍼즐: **145 / 312**
- 그중 다른 룰·clue 없이 bank만 있는 퍼즐: **41** (전부 비정형 보드)
- bank에 등장하는 서로 다른 도형: **46종** (회전·반사 동일 취급)

## 1. 도형 목록 (빈도순)

`빈도` = bank에 등장한 횟수(퍼즐 단위), `단독` = bank만 있는 퍼즐에서의 등장 횟수. 이름은 이 저장소의 `shapeName` 규칙(테트로미노 I/O/T/L/S, 펜토미노 F/I/L/N/P/T/U/V/W/X/Y/Z).

| # | 이름 | 칸 | 빈도 | 단독 | 모양 | 예시 퍼즐 ID |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | L3 | 3 | 43 | 7 | <code>█·<br>██</code> | 0066, 0643, 0053 |
| 2 | I3 | 3 | 38 | 7 | <code>█<br>█<br>█</code> | 0183, 0079, 1167 |
| 3 | I2 | 2 | 35 | 3 | <code>█<br>█</code> | 0050, 0067, 0067B |
| 4 | O4 | 4 | 30 | 7 | <code>██<br>██</code> | 0049, 0159, 0183 |
| 5 | L4 | 4 | 19 | 5 | <code>█·<br>█·<br>██</code> | 0008, 0009, 0180 |
| 6 | O1 | 1 | 16 | 0 | <code>█</code> | 0159, 0080, 1167 |
| 7 | S4 | 4 | 12 | 3 | <code>█·<br>██<br>·█</code> | 0180, 0174, 0059 |
| 8 | I4 | 4 | 11 | 4 | <code>█<br>█<br>█<br>█</code> | 0174, 0861, 0535 |
| 9 | T4 | 4 | 10 | 2 | <code>█·<br>██<br>█·</code> | 1065, 1069, 0174 |
| 10 | P5 | 5 | 8 | 1 | <code>█·<br>██<br>██</code> | 0054, 1069, 1170b |
| 11 | R2x3 | 6 | 8 | 2 | <code>██<br>██<br>██</code> | 0527, 1439, 0165 |
| 12 | V5 | 5 | 5 | 0 | <code>█··<br>█··<br>███</code> | 0474, 0329, 0528 |
| 13 | X5 | 5 | 5 | 2 | <code>·█·<br>███<br>·█·</code> | 0324, 1239, 0117 |
| 14 | R3x3 | 9 | 5 | 2 | <code>███<br>███<br>███</code> | 1167, 0422, 0423 |
| 15 | W5 | 5 | 4 | 2 | <code>█··<br>██·<br>·██</code> | 0061, 0065, 0105nopad |
| 16 | U5 | 5 | 4 | 0 | <code>██<br>█·<br>██</code> | 0424, 0085, 1276 |
| 17 | I5 | 5 | 3 | 1 | <code>█<br>█<br>█<br>█<br>█</code> | 0425, 1240, 0946 |
| 18 | F5 | 5 | 3 | 0 | <code>█··<br>███<br>·█·</code> | 0074, 1162, 0222 |
| 19 | Z5 | 5 | 3 | 0 | <code>█··<br>███<br>··█</code> | 0085, 0673, 1237 |
| 20 | R2x4 | 8 | 3 | 0 | <code>██<br>██<br>██<br>██</code> | 0535, 0538, 1279 |
| 21 | T5 | 5 | 2 | 1 | <code>█··<br>███<br>█··</code> | 0117, 0109 |
| 22 | L5 | 5 | 2 | 1 | <code>█·<br>█·<br>█·<br>██</code> | 0949, 0531 |
| 23 | Y5 | 5 | 2 | 0 | <code>█·<br>█·<br>██<br>█·</code> | 0109, 0222 |
| 24 | P6a | 6 | 2 | 1 | <code>█··<br>███<br>·██</code> | 0239, 1275 |
| 25 | P8a | 8 | 2 | 0 | <code>███<br>█·█<br>███</code> | 0694, 0099 |
| 26 | P9a | 9 | 2 | 2 | <code>███<br>██·<br>███<br>·█·</code> | 0056, 1285 |
| 27 | P12a | 12 | 2 | 0 | <code>████<br>█··█<br>█··█<br>████</code> | 0115, 1058 |
| 28 | N5 | 5 | 1 | 1 | <code>█·<br>█·<br>██<br>·█</code> | 0949 |
| 29 | P6b | 6 | 1 | 0 | <code>█··<br>██·<br>███</code> | 1069 |
| 30 | P6c | 6 | 1 | 0 | <code>█·<br>██<br>██<br>█·</code> | 0950 |
| 31 | P6d | 6 | 1 | 1 | <code>█··<br>█··<br>███<br>·█·</code> | 0055 |
| 32 | P6e | 6 | 1 | 1 | <code>█·<br>██<br>█·<br>██</code> | 0238 |
| 33 | P6f | 6 | 1 | 0 | <code>█··<br>█·█<br>███</code> | 1165 |
| 34 | P6g | 6 | 1 | 0 | <code>█·<br>█·<br>██<br>██</code> | 1236 |
| 35 | P7a | 7 | 1 | 1 | <code>██·<br>█·█<br>███</code> | 0012 |
| 36 | P7b | 7 | 1 | 1 | <code>█··<br>█··<br>█··<br>█··<br>███</code> | 0551 |
| 37 | P7c | 7 | 1 | 1 | <code>█··<br>█··<br>███<br>█··<br>█··</code> | 0551 |
| 38 | P7d | 7 | 1 | 1 | <code>█··<br>███<br>███</code> | 1444 |
| 39 | P7e | 7 | 1 | 1 | <code>█···<br>████<br>█·█·</code> | 1251 |
| 40 | P8b | 8 | 1 | 1 | <code>██·<br>███<br>███</code> | 1393 |
| 41 | P8c | 8 | 1 | 1 | <code>·█·<br>██·<br>·█·<br>███<br>·█·</code> | 0235 |
| 42 | P9b | 9 | 1 | 1 | <code>███·<br>·███<br>███·</code> | 1285 |
| 43 | P10a | 10 | 1 | 0 | <code>██··<br>█··█<br>█··█<br>████</code> | 1275 |
| 44 | R3x4 | 12 | 1 | 0 | <code>███<br>███<br>███<br>███</code> | 1445 |
| 45 | P14a | 14 | 1 | 1 | <code>·█···<br>████·<br>█··██<br>██··█<br>·██··<br>··█··</code> | 0236 |
| 46 | P17a | 17 | 1 | 0 | <code>█████<br>█····<br>█·███<br>█···█<br>█████</code> | 1046 |

### 크기별 요약

| 칸 수 | 종류 | 도형 |
| --- | --- | --- |
| 1 | 1 | O1×16 |
| 2 | 1 | I2×35 |
| 3 | 2 | L3×43, I3×38 |
| 4 | 5 | O4×30, L4×19, S4×12, I4×11, T4×10 |
| 5 | 12 | P5×8, V5×5, X5×5, W5×4, U5×4, I5×3, F5×3, Z5×3, T5×2, L5×2, Y5×2, N5×1 |
| 6 | 8 | R2x3×8, P6a×2, P6b×1, P6c×1, P6d×1, P6e×1, P6f×1, P6g×1 |
| 7 | 5 | P7a×1, P7b×1, P7c×1, P7d×1, P7e×1 |
| 8 | 4 | R2x4×3, P8a×2, P8b×1, P8c×1 |
| 9 | 3 | R3x3×5, P9a×2, P9b×1 |
| 10 | 1 | P10a×1 |
| 12 | 2 | P12a×2, R3x4×1 |
| 14 | 1 | P14a×1 |
| 17 | 1 | P17a×1 |

크기 1~4 도형(모노미노, 도미노, 트로미노 2종, 테트로미노 5종)은 **전부** 쓰이고, 펜토미노 12종도 전부 등장합니다. 6칸 이상은 대부분 직사각형(2×3, 2×4, 3×3, 3×4)이거나 그 변형(ㄷ, ㅁ 테두리, 십자)입니다.

## 2. bank 구성

| bank 도형 수 | 퍼즐 수 |
| --- | --- |
| 1 | 31 |
| 2 | 78 |
| 3 | 33 |
| 4 | 3 |

도형 칸 수 조합(bank 안의 도형 크기들): 4칸 ×17, 3칸 ×16, 3/4칸 ×12, 2/3칸 ×12, 3/4/5칸 ×9, 5칸 ×7, 6칸 ×6, 3/5칸 ×6, 4/5칸 ×6, 1/2/3칸 ×5, 7칸 ×4, 1/4칸 ×4, 2칸 ×3, 4/9칸 ×3, 2/5칸 ×3, 1/2/4칸 ×2, 2/3/4칸 ×2, 2/4칸 ×2, 4/6칸 ×2, 3/4/6/8칸 ×2, 9칸 ×2, 8칸 ×2, 1/2칸 ×1, 1/3/9칸 ×1, 2/4/6칸 ×1, 1/3칸 ×1, 4/5/6칸 ×1, 1/2/6칸 ×1, 4/12칸 ×1, 4/8칸 ×1, 12칸 ×1, 14칸 ×1, 1/4/8칸 ×1, 2/8칸 ×1, 6/10칸 ×1, 2/3/5칸 ×1, 4/6/9칸 ×1, 5/6칸 ×1, 2/17칸 ×1, 3/12칸 ×1

자주 쓰는 조합(2회 이상):

- I3 + L3 ×11
- L4 ×5
- I3 + O4 ×5
- I2 + L3 ×5
- I2 + I3 ×5
- L3 ×4
- I2 ×3
- L4 + S4 ×3
- I2 + L3 + O1 ×3
- O4 + R3x3 ×3
- I2 + O1 + O4 ×2
- I2 + I3 + O1 ×2
- I2 + I3 + L3 ×2
- L3 + L4 + V5 ×2
- I4 + R2x3 ×2
- I3 + I4 + R2x3 + R2x4 ×2
- I4 + O4 ×2
- I3 + I4 ×2
- O1 + O4 ×2
- L3 + S4 + W5 ×2
- L4 + T4 ×2
- I2 + X5 ×2

## 3. 보드 형태

- 비정형(구멍/파인 윤곽) 보드: 104 / 145. bank만 있는 퍼즐은 41 / 41 전부 비정형.
- 활성 칸 수: 최소 9, 중앙값 38, 최대 196. 외곽 사각형은 4×4부터 14×14까지.
- 비정형 보드 104개의 대칭: 좌우+상하 11, 좌우만 12, 상하만 0, 180° 회전만 8, **비대칭 73**. 원작 보드는 스테인드글라스 창의 윤곽입니다. 하트·십자·꽃·팔각형처럼 대칭인 것도 있지만, 다수는 비대칭 계단형·홈 모양이거나 가운데 구멍이 여러 개 뚫린 형태입니다.
- Shape Bank와 함께 쓰인 룰: Mingle 25, Polyomino 22, Rose 16, Delta 37, Gemini 34.

예시 (bank만 있는 보드, `#` = 칸):

`0012.puz` 7×7, 난이도 3, bank [P7a]

```
..###..
..#.#..
..#####
###.#.#
#.#####
###.#..
..###..
```

`0054.puz` 5×5, 난이도 3, bank [P5]

```
###..
####.
#####
.####
.####
```

`0425.puz` 11×10, 난이도 4, bank [I3, I4, I5]

```
....#......
....#......
....#####..
...#####...
###########
.####.####.
..###.###..
..##..###..
..##...##..
.......#...
```

`1393.puz` 12×10, 난이도 6, bank [O4, P8b]

```
############
############
############
############
####..######
####...#####
####...#####
############
############
############
```

## 4. 우리 생성기에 대한 시사점

- bank 크기는 1~3개가 표준(4개는 3회뿐). 도형은 2~5칸이 대부분이고, 큰 직사각형(2×3, 3×3)이 작은 도형과 섞이는 패턴이 흔하다.
- 원작은 bank 단독 퍼즐을 **비정형 보드의 윤곽**으로 유일해를 만든다. 우리 `--mask` 방식과 같은 발상이다. 다만 원작 윤곽은 대칭(하트·십자)과 비대칭 계단형이 섞여 있고 통계상 비대칭이 더 많다.
- 랜덤 도형 대신 위 목록을 가중치 있는 **도형 카탈로그**로 쓰면 원작 느낌에 가까워진다(`randomBank` 대체).
- Single Shape(bank 1개) 12개는 튜토리얼 성격이고, 어려운 것(난이도 5~7)은 큰 보드(10×10 이상)에 2~3개 도형이다.

## 부록. Shape Bank가 있는 Act I 퍼즐 전체 (145)

| 구역 | ID | 외곽 | 칸 | 난이도 | bank | 다른 룰 |
| --- | --- | --- | --- | --- | --- | --- |
| Single Shape | 0008 | 5×6 | 20 | 1 | L4 |  |
| Single Shape | 0049 | 4×4 | 12 | 1 | O4 |  |
| Single Shape | 0050 | 4×4 | 10 | 1 | I2 |  |
| Single Shape | 0066 | 3×4 | 12 | 1 | L3 |  |
| Single Shape | 0067 | 4×4 | 16 | 1 | I2 |  |
| Single Shape | 0067B | 3×4 | 12 | 1 | I2 |  |
| Single Shape | 0643 | 4×4 | 9 | 1 | L3 |  |
| Single Shape | 0009 | 4×5 | 16 | 2 | L4 |  |
| Single Shape | 0053 | 4×4 | 12 | 2 | L3 |  |
| Single Shape | 0527 | 7×8 | 36 | 2 | R2x3 |  |
| Single Shape | 0012 | 7×7 | 28 | 3 | P7a |  |
| Single Shape | 0054 | 5×5 | 20 | 3 | P5 |  |
| Shape Bank | 0051 | 5×4 | 15 | 1 | I3, L3 |  |
| Shape Bank | 0052 | 4×6 | 16 | 1 | I4, O4 |  |
| Shape Bank | 0058 | 4×7 | 10 | 1 | I2, L3 |  |
| Shape Bank | 0059 | 5×7 | 21 | 1 | I3, S4 |  |
| Shape Bank | 0057 | 5×6 | 15 | 2 | I2, L3 |  |
| Shape Bank | 0115 | 5×9 | 32 | 2 | O4, P12a |  |
| Shape Bank | 0426 | 6×8 | 25 | 2 | I3, I4 |  |
| Shape Bank | 0072 | 6×6 | 28 | 3 | L4, S4 |  |
| Shape Bank | 0422 | 7×6 | 42 | 3 | O4, R3x3 |  |
| Shape Bank | 0425 | 11×10 | 47 | 4 | I3, I4, I5 |  |
| Shape Bank | 1393 | 12×10 | 112 | 6 | O4, P8b |  |
| Gemini & Delta | 0095 | 5×4 | 18 | 1 | I3, L3 | Gemini |
| Gemini & Delta | 0096 | 5×4 | 18 | 1 | I3, L3 | Delta |
| Gemini & Delta | 0101 | 6×6 | 36 | 1 | I4, O4 | Delta |
| Gemini & Delta | 0693b | 5×4 | 15 | 1 | I2, I3 | Delta, Gemini |
| Gemini & Delta | 1271 | 5×6 | 28 | 1 | I3, O4 | Gemini |
| Gemini & Delta | 1281 | 4×6 | 18 | 1 | O1, O4 | Delta, Gemini |
| Gemini & Delta | 0043 | 6×6 | 36 | 2 | I3, L3 | Delta |
| Gemini & Delta | 0042 | 6×6 | 36 | 3 | I3, L3 | Gemini |
| Shape Bank II | 0950 | 12×5 | 60 | 1 | P6c |  |
| Shape Bank II | 0055 | 6×6 | 24 | 2 | P6d |  |
| Shape Bank II | 0056 | 10×11 | 81 | 2 | P9a |  |
| Shape Bank II | 0061 | 6×6 | 27 | 2 | L4, W5 |  |
| Shape Bank II | 0074 | 7×7 | 30 | 2 | F5 |  |
| Shape Bank II | 0238 | 5×7 | 24 | 2 | P6e |  |
| Shape Bank II | 0239 | 5×7 | 24 | 2 | P6a |  |
| Shape Bank II | 1239 | 11×5 | 42 | 2 | I3, O4, X5 |  |
| Shape Bank II | 1445 | 12×10 | 120 | 2 | R3x4 |  |
| Shape Bank II | 0060 | 5×7 | 24 | 3 | S4, T4 |  |
| Shape Bank II | 0235 | 11×9 | 56 | 3 | P8c |  |
| Shape Bank II | 0236 | 12×7 | 56 | 3 | P14a |  |
| Shape Bank II | 0266 | 10×10 | 57 | 3 | L3 |  |
| Shape Bank II | 0267 | 11×11 | 96 | 3 | I3 |  |
| Shape Bank II | 0416 | 8×8 | 47 | 3 | O4, I3 |  |
| Shape Bank II | 0423 | 8×10 | 60 | 3 | O4, R3x3 |  |
| Shape Bank II | 1240 | 6×10 | 60 | 3 | P5, I5 |  |
| Shape Bank II | 0064 | 8×8 | 56 | 4 | R2x3, I4 |  |
| Shape Bank II | 0077 | 7×6 | 40 | 4 | I3, O4 |  |
| Shape Bank II | 0117 | 7×7 | 35 | 4 | T5, X5 |  |
| Shape Bank II | 0424 | 6×8 | 30 | 4 | L3, U5 |  |
| Shape Bank II | 0551 | 9×13 | 84 | 4 | P7b, P7c |  |
| Shape Bank II | 1444 | 11×11 | 112 | 4 | P7d |  |
| Shape Bank II | 0065 | 7×8 | 47 | 5 | L3, S4, W5 |  |
| Shape Bank II | 0237 | 14×14 | 88 | 5 | L4 |  |
| Shape Bank II | 0949 | 9×11 | 55 | 5 | L5, N5 |  |
| Shape Bank II | 1251 | 12×12 | 105 | 5 | P7e |  |
| Shape Bank II | 1285 | 12×10 | 108 | 5 | P9a, P9b |  |
| Shape Bank II | 0085 | 10×10 | 90 | 6 | P5, U5, Z5 |  |
| Shape Bank II | 0124 | 14×12 | 152 | 6 | O4, R3x3 |  |
| Shape Bank II | 0948 | 13×13 | 72 | 7 | L4, T4 |  |
| Gemini & Delta II | 0107nopad | 6×6 | 27 | 1 | I2, L3 | Delta, Gemini |
| Gemini & Delta II | 0530 | 5×6 | 30 | 1 | O1, O4 | Delta, Gemini |
| Gemini & Delta II | 0694 | 6×6 | 36 | 1 | O1, O4, P8a | Delta |
| Gemini & Delta II | 1160 | 9×4 | 36 | 1 | I3, L3 | Delta, Gemini |
| Gemini & Delta II | 1161 | 5×6 | 30 | 1 | I2, T4 | Delta, Gemini |
| Gemini & Delta II | 1276 | 7×4 | 18 | 1 | O4, U5 | Gemini |
| Gemini & Delta II | 0097 | 6×5 | 28 | 2 | L4, S4 | Gemini |
| Gemini & Delta II | 0099 | 7×8 | 50 | 2 | I2, P8a | Delta, Gemini |
| Gemini & Delta II | 0531 | 5×7 | 35 | 2 | L3, L4, L5 | Delta, Gemini |
| Gemini & Delta II | 0672 | 5×5 | 25 | 2 | I2, L3, I3 | Gemini |
| Gemini & Delta II | 0692 | 4×4 | 16 | 2 | L3, O4 | Delta, Gemini |
| Gemini & Delta II | 1280 | 7×7 | 38 | 2 | I2, X5 | Delta |
| Gemini & Delta II | 0027 | 6×6 | 36 | 3 | I3, L3 | Delta, Gemini |
| Gemini & Delta II | 0108 | 7×7 | 24 | 3 | I2, I3 | Delta, Gemini |
| Gemini & Delta II | 0529 | 8×8 | 64 | 3 | I3, I4 | Delta, Gemini |
| Gemini & Delta II | 0673 | 7×7 | 38 | 3 | L3, Z5 | Delta |
| Gemini & Delta II | 1162 | 8×7 | 38 | 3 | I2, F5 | Delta, Gemini |
| Gemini & Delta II | 1275 | 8×4 | 32 | 3 | P10a, P6a | Delta, Gemini |
| Gemini & Delta II | 1415pad | 7×8 | 35 | 3 | I2, L3 | Delta |
| Gemini & Delta II | 0091 | 7×5 | 35 | 4 | I2, I3 | Delta, Gemini |
| Gemini & Delta II | 0105nopad | 7×7 | 34 | 4 | W5, L3 | Delta |
| Gemini & Delta II | 0106nopad | 7×7 | 48 | 4 | T4, L4 | Delta, Gemini |
| Gemini & Delta II | 0528 | 9×6 | 54 | 4 | O4, V5 | Delta, Gemini |
| Gemini & Delta II | 0946 | 8×7 | 56 | 4 | O4, I3, I5 | Delta, Gemini |
| Gemini & Delta II | 0109 | 7×9 | 61 | 5 | S4, T5, Y5 | Delta, Gemini |
| Gemini & Delta II | 0536 | 9×9 | 65 | 5 | I2, L3, V5 | Delta, Gemini |
| Gemini & Delta II | 0114 | 14×14 | 196 | 6 | O4, R2x3, R3x3 | Delta, Gemini |
| Gemini & Delta II | 0533 | 11×11 | 62 | 6 | L3, L4, P5 | Delta, Gemini |
| Rose Windows II | 0801 | 6×6 | 32 | 1 | T4 | Rose |
| Rose Windows II | 0803 | 7×6 | 28 | 2 | L4 | Rose |
| Rose Windows II | 1165 | 7×7 | 28 | 2 | U5, P6f | Rose |
| Rose Windows II | 1274 | 6×6 | 36 | 2 | O1, I4 | Rose |
| Rose Windows II | 1279 | 8×6 | 48 | 2 | R2x4 | Rose |
| Rose Windows II | 0195 | 6×6 | 36 | 3 | I3, O4 | Rose |
| Rose Windows II | 0221 | 7×8 | 42 | 3 | L3, I3 | Rose |
| Rose Windows II | 0802 | 7×7 | 40 | 3 | L4 | Rose |
| Rose Windows II | 1236 | 9×10 | 90 | 5 | P6g | Rose |
| Rose Windows II | 1237 | 11×11 | 88 | 5 | S4, Z5 | Rose |
| Rose Windows II | 0222 | 8×8 | 60 | 6 | F5, P5, Y5 | Rose |
| Rose Windows II | 0223 | 11×11 | 121 | 7 | L3, S4, W5 | Rose |
| Polyomino | 1057 | 6×8 | 37 | 1 | O4, P5 | Polyomino |
| Polyomino | 0123 | 5×5 | 25 | 2 | I2, I3 | Polyomino |
| Polyomino | 1053 | 8×7 | 48 | 2 | I2, X5 | Polyomino |
| Polyomino | 0144 | 6×6 | 36 | 3 | L3, L4 | Polyomino |
| Polyomino | 0147 | 8×8 | 48 | 3 | I3, S4, O4 | Polyomino |
| Polyomino | 1046 | 6×6 | 35 | 3 | P17a, I2 | Polyomino |
| Polyomino | 0150 | 6×6 | 36 | 4 | I3, L3 | Polyomino |
| Polyomino | 1058 | 9×10 | 60 | 4 | L3, P12a | Polyomino |
| Polyomino | 1245 | 9×9 | 68 | 6 | L4, S4, T4 | Polyomino |
| Polyomino | 0153 | 13×13 | 105 | 7 | L3, L4, V5 | Polyomino |
| Mingle Shape | 0159 | 4×4 | 16 | 1 | O1, I2, O4 | Mingle |
| Mingle Shape | 0183 | 5×6 | 21 | 1 | I3, O4 | Mingle |
| Mingle Shape | 0474 | 8×7 | 41 | 1 | L3, V5 | Mingle |
| Mingle Shape | 0079 | 6×5 | 18 | 2 | I3, L3 | Mingle |
| Mingle Shape | 0080 | 6×5 | 17 | 2 | O1, I2 | Mingle |
| Mingle Shape | 0324 | 8×8 | 41 | 2 | L3, X5 | Mingle |
| Mingle Shape | 1029 | 6×6 | 30 | 2 | I2, L3 | Mingle |
| Mingle Shape | 1167 | 7×9 | 52 | 2 | O1, I3, R3x3 | Mingle |
| Mingle Shape | 1439 | 10×8 | 60 | 2 | I2, O4, R2x3 | Mingle |
| Mingle Shape | 0180 | 8×7 | 40 | 3 | L4, S4 | Mingle |
| Mingle Shape | 1065 | 5×5 | 25 | 3 | O1, T4 | Mingle |
| Mingle Shape | 1066 | 9×6 | 32 | 3 | O1, L3 | Mingle |
| Mingle Shape | 1122 | 8×8 | 39 | 3 | I2, I3 | Mingle |
| Mingle Shape | 1243 | 7×5 | 27 | 3 | O1, I2, L3 | Mingle, Polyomino |
| Mingle Shape | 0167 | 9×7 | 53 | 4 | I2, I3, O4 | Mingle |
| Mingle Shape | 0181 | 6×5 | 30 | 4 | O1, I2, I3 | Mingle, Polyomino |
| Mingle Shape | 1069 | 10×9 | 77 | 4 | T4, P5, P6b | Mingle, Polyomino |
| Mingle Shape | 1070 | 7×6 | 41 | 4 | L3, L4, O4 | Mingle, Rose |
| Mingle Shape | 1244 | 8×5 | 40 | 4 | O1, I2, L3 | Mingle, Polyomino |
| Mingle Shape | 1252 | 7×8 | 50 | 4 | O1, I2, L3 | Mingle, Polyomino |
| Mingle Shape | 0157 | 9×6 | 54 | 5 | O1, I2, O4 | Mingle |
| Mingle Shape | 0165 | 9×8 | 70 | 5 | O1, I2, R2x3 | Mingle |
| Mingle Shape | 1068 | 9×8 | 52 | 5 | I2, I3, L3 | Mingle, Polyomino |
| Mingle Shape | 0201 | 9×9 | 81 | 6 | O1, I2, I3 | Mingle, Polyomino |
| Mingle Shape | 0329 | 10×9 | 77 | 6 | L3, L4, V5 | Mingle |
| Mixed Rules | 0178 | 6×6 | 36 | 2 | I3, L3 | Delta, Polyomino |
| Mixed Rules | 1170b | 9×9 | 61 | 3 | I3, P5 | Delta, Gemini, Polyomino |
| Mixed Rules | 0173 | 9×9 | 72 | 4 | I2, O4 | Delta, Polyomino |
| Mixed Rules | 0174 | 10×10 | 80 | 4 | I4, L4, S4, T4 | Gemini, Polyomino |
| Mixed Rules | 0861 | 11×11 | 120 | 4 | I4, R2x3 | Delta, Gemini, Rose |
| Mixed Rules | 0535 | 12×12 | 108 | 5 | I3, R2x3, I4, R2x4 | Delta, Gemini, Rose |
| Mixed Rules | 0538 | 11×9 | 99 | 5 | I3, R2x3, I4, R2x4 | Delta, Gemini, Rose |
| Mixed Rules | 0784 | 9×9 | 81 | 6 | I2, L3, T4 | Delta, Gemini, Polyomino |
