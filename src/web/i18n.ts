/**
 * UI language. Korean and English, following the terms the original game
 * uses in each language (window, cell, region, border, area; rule names).
 * Picked from localStorage, then the URL (`#…&lang=`), then the browser.
 */
export type Lang = 'ko' | 'en';

function detect(): Lang {
  // the analysis module is also used from tests under Node, where there is no browser
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('pbp:lang');
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  // a language given in a shared link sticks (the app rewrites the hash without it)
  const q = new URLSearchParams(location.hash.slice(1)).get('lang');
  if (q === 'ko' || q === 'en') {
    try {
      localStorage.setItem('pbp:lang', q);
    } catch {
      /* ignore */
    }
    return q;
  }
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const lang: Lang = detect();

export function setLang(next: Lang): void {
  try {
    localStorage.setItem('pbp:lang', next);
  } catch {
    /* ignore */
  }
  location.reload();
}

/** Korean particle after a word or a digit (Sino-Korean numerals 0,1,3,6,7,8 end in a consonant). */
export function particle(word: string, withBatchim: string, without: string): string {
  const ch = word[word.length - 1] ?? '';
  const code = ch.charCodeAt(0);
  const batchim = ch >= '0' && ch <= '9' ? '013678'.includes(ch) : code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  return batchim ? withBatchim : without;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ko = {
  // header
  title: 'pane by pane',
  goal: '목표',
  undo: '되돌리기',
  redo: '다시 실행',
  clear: '전부 지우기',
  undoTitle: '되돌리기 (⌘Z)',
  redoTitle: '다시 실행 (⇧⌘Z)',
  langSwitch: 'EN',
  langSwitchTitle: 'Switch to English',
  // dialogs
  goalDesc: '규칙을 지켜 창의 모든 칸을 색유리로 채우거나, 모든 구역의 경계선을 그리세요.',
  close: '닫기',
  revealTitle: '정답 보기',
  revealText: '정답을 보면 이 창은 직접 푼 것으로 남지 않습니다. 정말 보시겠어요?',
  cancel: '취소',
  warnTitle: '창을 만들 수 없습니다',
  ok: '확인',
  // toolbar
  eraser: '지우개 (드래그)',
  check: '규칙 확인',
  hint: '힌트',
  hintMore: '힌트 (더 자세히)',
  hintApply: '힌트 적용',
  reveal: '정답 보기',
  hideSolution: '정답 가리기',
  errorMode: '오류 표시',
  errAlways: '항상 (규칙을 어긴 칸에 빗금)',
  errCheck: '규칙 확인을 눌렀을 때',
  errOff: '끄기',
  controls: '조작법',
  ctl: [
    ['빈 칸 탭', '새 구역 시작'],
    ['드래그', '지나간 칸을 한 구역으로 (경계선은 못 넘음)'],
    ['칠한 칸 탭', '지우기'],
    ['칸 사이 탭', '경계선 그리기 · 다시 탭하면 지우기'],
    ['지우개', '드래그로 여러 칸 지우기'],
    ['길게 누르기', '그 구역의 넓이'],
    ['완성', '경계선을 전부 그리거나 칸을 전부 칠하면'],
  ],
  share: '퍼즐 공유',
  copied: '링크 복사됨',
  madeBy: '만든 사람',
  // form
  newWindow: '새 창 만들기',
  size: '크기',
  rules: '규칙',
  rule: {
    areaNumber: '넓이의 수',
    range: '넓이의 범위',
    precision: '정밀한 넓이',
    shapeBank: '도형 창고',
    polyomino: '폴리오미노',
    gemini: '쌍둥이',
    delta: '닮지 않은 둘',
    rose: '장미창',
    sizeSeparation: '넓이 구분',
    fixedWalls: '고정 경계선',
  },
  roseCount: '장미창 기호 수',
  regionArea: '구역 넓이',
  difficulty: '난이도',
  mask: '비정형 창',
  walls: '고정 경계선',
  seed: 'seed',
  seedPlaceholder: '비우면 랜덤',
  generate: '창 만들기',
  // rule descriptions (goal dialog)
  desc: {
    fixedWalls: '미리 그어진 경계선을 사이에 두고 같은 구역이 될 수 없다.',
    areaNumber: '숫자가 있는 구역의 넓이는 그 숫자와 같아야 한다.',
    precision: (n: number) => `모든 구역의 넓이는 ${n}이어야 한다.`,
    range: (lo?: number, hi?: number) => `모든 구역의 넓이는 ${hi === undefined ? `${lo} 이상` : lo === undefined ? `${hi} 이하` : `${lo} 이상 ${hi} 이하`}여야 한다.`,
    shapeBank: '모든 구역은 목록에 제시된 형태 중 하나여야 한다. (회전·뒤집기 가능)',
    rose: (symbols: string) => `각 구역은 모든 장미창 기호(${symbols})를 정확히 하나씩 포함해야 한다.`,
    sizeSeparation: '인접한 구역은 서로 다른 넓이를 가져야 한다.',
    polyomino: '폴리오미노 기호를 포함하는 구역은 기호와 같은 형태여야 한다.',
    gemini: '= 기호 양쪽의 두 구역은 서로 같은 형태여야 한다.',
    delta: '≠ 기호 양쪽의 두 구역은 서로 다른 형태여야 한다.',
  },
  difficultyLabel: (stars: string, value: string) => `난이도 ${stars} (${value})`,
  // goal strip above the window: one short chip per rule, tap for the full text
  chip: {
    areaNumber: '숫자 = 넓이',
    precision: (n: number) => `넓이 = ${n}`,
    range: (lo?: number, hi?: number) => (hi === undefined ? `넓이 ≥ ${lo}` : lo === undefined ? `넓이 ≤ ${hi}` : `넓이 ${lo}–${hi}`),
    shapeBank: '도형',
    polyomino: '폴리오미노',
    gemini: '= 같은 모양',
    delta: '≠ 다른 모양',
    rose: (symbols: string) => `${symbols} 하나씩`,
    sizeSeparation: '이웃과 넓이 다름',
    open: '규칙 자세히 보기',
  },
  coachTitle: '이 창의 규칙',
  coachText: '위의 요약을 누르면 자세한 설명이 열립니다. 칸을 드래그해 색유리를 채우고, 칸 사이를 눌러 경계선을 그리세요.',
  coachOk: '알겠어요',
  // status
  generating: '생성 중…',
  generatingAttempt: (n: number) => `생성 중… (시도 ${n})`,
  generatedIn: (s: string, seed: number) => `${s}s · seed ${seed}`,
  error: (m: string) => `오류: ${m}`,
  areaOf: (n: number) => `이 구역: 넓이 ${n}`,
  complete: '창이 완성되었습니다 ✦',
  dangling: '끊긴 경계선이 있습니다',
  wrong: '전부 칠했지만 규칙에 맞지 않습니다',
  checkResult: (cells: number, edges: number) => {
    const parts: string[] = [];
    if (cells) parts.push(`칸 ${cells}개`);
    if (edges) parts.push(`경계선 ${edges}개`);
    return parts.length ? `규칙을 어긴 ${parts.join('와 ')}를 빗금으로 표시했습니다` : '지금까지의 표시는 규칙을 어기지 않았습니다';
  },
  hintDone: '이미 완성했습니다.',
  hintNone: '더 이상 알려줄 추론이 없습니다.',
  mistakeWall: '이 경계선이 잘못되었습니다. 지우고 다시 생각해 보세요.',
  mistakeCells: '이 두 칸은 같은 구역이 아닙니다. 색을 지우고 다시 생각해 보세요.',
  mistakeOther: '표시들이 서로 어긋납니다. 되돌리기로 확인해 보세요.',
  revealing: '정답을 보는 중입니다. 가리면 내 표시로 돌아갑니다.',
  // warnings
  warnNoPuzzle: '이 설정으로는 창을 못 만들었습니다. 규칙 조합이나 난이도를 바꿔 보세요.',
  warnNoRules: '규칙을 하나 이상 고르세요.',
  warnCannotOutline: '쌍둥이, 닮지 않은 둘, 넓이 구분은 구역을 나누는 것을 막지 못해 단독으로는 정답이 하나로 정해지지 않습니다. 넓이의 범위나 넓이의 수 등을 함께 켜 주세요.',
  warnGeminiSizeSep: '쌍둥이와 넓이 구분은 함께 쓸 수 없습니다. 쌍둥이 기호 양쪽은 모양이 같아 넓이도 같은데, 넓이 구분은 이웃한 구역의 넓이가 달라야 하기 때문입니다.',
  // hints
  h: {
    withNumber: (n: number) => `숫자 ${n}${particle(String(n), '이', '가')} 있는 구역`,
    withPolyomino: '도형 기호가 있는 구역',
    withSymbol: (glyph: string) => `${glyph} 기호가 있는 구역`,
    cellAt: (row: number, col: number) => `${row}행 ${col}열 칸`,
    ofSize: (n: number) => `${n}칸짜리 구역`,
    where: (A: string) => `${A} 근처를 보세요.`,
    exactly: (n: number) => `${n}칸`,
    atLeast: (n: number) => `최소 ${n}칸`,
    needed: '필요한 넓이',
    isBorder: '이 사이는 경계선입니다.',
    isSame: '이 칸은 같은 구역입니다.',
    fixedWall: '미리 그어진 경계선입니다.',
    markerWall: '기호가 있는 자리는 항상 경계선입니다.',
    sameSymbol: '같은 기호가 두 개 있는 구역은 없습니다. 이 사이는 경계선입니다.',
    sizeFull: (A: string, n: number) => `${A}${particle(A, '은', '는')} 이미 ${n}칸이라 더 넓어질 수 없습니다. 이 사이는 경계선입니다.`,
    mergeConflict: (A: string, B: string) => `${A}${particle(A, '과', '와')} ${B}${particle(B, '을', '를')} 합치면 규칙에 어긋납니다. 이 사이는 경계선입니다.`,
    forcedExit: (A: string) => `${A}${particle(A, '이', '가')} 더 넓어질 수 있는 곳은 이 칸뿐입니다. 이 칸은 같은 구역입니다.`,
    reachExact: (A: string, target: string) => `${A}${particle(A, '이', '가')} ${target}이 되려면 닿을 수 있는 칸을 전부 써야 합니다. 이 칸은 같은 구역입니다.`,
    shapePlaceWall: (A: string) => `${A}에 허용된 형태를 어떻게 놓아도 이 칸은 들어가지 않습니다. 이 사이는 경계선입니다.`,
    shapePlaceJoin: (A: string) => `${A}에 허용된 형태를 어떻게 놓아도 이 칸은 들어갑니다. 이 칸은 같은 구역입니다.`,
    bifurcationWall: '여기가 같은 구역이라고 가정하면 곧 모순이 생깁니다. 이 사이는 경계선입니다.',
    bifurcationJoin: '여기에 경계선이 있다고 가정하면 곧 모순이 생깁니다. 이 칸은 같은 구역입니다.',
    technique: {
      'fixed-wall': '미리 그어진 경계선입니다.',
      'marker-wall': '기호가 있는 자리는 경계선입니다.',
      'same-symbol': '같은 기호끼리는 한 구역이 될 수 없습니다.',
      'size-full': '이 구역은 이미 최대 넓이이므로 더 넓어질 수 없습니다.',
      'merge-conflict': '양쪽을 합치면 규칙에 어긋나므로 경계선입니다.',
      'forced-exit': '이 구역이 더 커질 수 있는 길이 이 한 곳뿐입니다.',
      'reach-exact': '필요한 넓이를 채우려면 닿을 수 있는 칸을 전부 써야 합니다.',
      'shape-place': '허용된 형태를 놓아 보면 여기는 정해져 있습니다.',
      bifurcation: '반대로 가정하면 모순이 납니다.',
    } as Record<string, string>,
  },
};

const en: typeof ko = {
  title: 'pane by pane',
  goal: 'Goal',
  undo: 'Undo',
  redo: 'Redo',
  clear: 'Clear all',
  undoTitle: 'Undo (⌘Z)',
  redoTitle: 'Redo (⇧⌘Z)',
  langSwitch: '한국어',
  langSwitchTitle: '한국어로 보기',
  goalDesc: 'Following the rules, fill every cell of the window with coloured glass, or draw every border between regions.',
  close: 'Close',
  revealTitle: 'Show solution',
  revealText: 'Once you look at the solution, this window will not count as solved by you. Show it anyway?',
  cancel: 'Cancel',
  warnTitle: 'Cannot build this window',
  ok: 'OK',
  eraser: 'Eraser (drag)',
  check: 'Check rules',
  hint: 'Hint',
  hintMore: 'Hint (more)',
  hintApply: 'Apply hint',
  reveal: 'Show solution',
  hideSolution: 'Hide solution',
  errorMode: 'Error display',
  errAlways: 'Always (hatch cells that break a rule)',
  errCheck: 'Only when I press Check rules',
  errOff: 'Off',
  controls: 'Controls',
  ctl: [
    ['Tap an empty cell', 'start a region'],
    ['Drag', 'join the cells into one region (never across a border)'],
    ['Tap a painted cell', 'clear it'],
    ['Tap between cells', 'draw a border · tap again to remove'],
    ['Eraser', 'drag to clear several cells'],
    ['Long-press', 'the area of that region'],
    ['Finished', 'when every border is drawn, or every cell painted'],
  ],
  share: 'Share',
  copied: 'Link copied',
  madeBy: 'Made by',
  newWindow: 'New window',
  size: 'Size',
  rules: 'Rules',
  rule: {
    areaNumber: 'Area Number',
    range: 'Range',
    precision: 'Precision',
    shapeBank: 'Shape Bank',
    polyomino: 'Polyomino',
    gemini: 'Gemini',
    delta: 'Delta',
    rose: 'Rose Window',
    sizeSeparation: 'Size Separation',
    fixedWalls: 'Fixed borders',
  },
  roseCount: 'Rose Window symbols',
  regionArea: 'Region area',
  difficulty: 'Difficulty',
  mask: 'Irregular window',
  walls: 'Fixed borders',
  seed: 'Seed',
  seedPlaceholder: 'blank = random',
  generate: 'Build window',
  desc: {
    fixedWalls: 'Two cells on either side of a pre-drawn border are never in the same region.',
    areaNumber: 'A region containing a number has exactly that many cells.',
    precision: (n: number) => `Every region has an area of exactly ${n}.`,
    range: (lo?: number, hi?: number) => `Every region has an area ${hi === undefined ? `of at least ${lo}` : lo === undefined ? `of at most ${hi}` : `between ${lo} and ${hi}`}.`,
    shapeBank: 'Every region has one of the listed shapes (rotations and reflections allowed).',
    rose: (symbols: string) => `Every region contains each Rose Window symbol (${symbols}) exactly once.`,
    sizeSeparation: 'Neighbouring regions have different areas.',
    polyomino: 'A region containing a polyomino symbol has exactly that shape.',
    gemini: 'The two regions on either side of an = symbol have the same shape.',
    delta: 'The two regions on either side of a ≠ symbol have different shapes.',
  },
  difficultyLabel: (stars: string, value: string) => `Difficulty ${stars} (${value})`,
  chip: {
    areaNumber: 'number = area',
    precision: (n: number) => `area = ${n}`,
    range: (lo?: number, hi?: number) => (hi === undefined ? `area ≥ ${lo}` : lo === undefined ? `area ≤ ${hi}` : `area ${lo}–${hi}`),
    shapeBank: 'shapes',
    polyomino: 'polyomino',
    gemini: '= same shape',
    delta: '≠ different shape',
    rose: (symbols: string) => `${symbols} once each`,
    sizeSeparation: 'neighbours differ',
    open: 'Show the rules in full',
  },
  coachTitle: 'The rules of this window',
  coachText: 'Tap the summary above for the full description. Drag across cells to fill them with glass; tap between two cells to draw a border.',
  coachOk: 'Got it',
  generating: 'Building…',
  generatingAttempt: (n: number) => `Building… (attempt ${n})`,
  generatedIn: (s: string, seed: number) => `${s}s · seed ${seed}`,
  error: (m: string) => `Error: ${m}`,
  areaOf: (n: number) => `This region: area ${n}`,
  complete: 'The window is complete ✦',
  dangling: 'A border is left dangling',
  wrong: 'Everything is painted, but a rule is broken',
  checkResult: (cells: number, edges: number) => {
    const parts: string[] = [];
    if (cells) parts.push(`${cells} cell${cells === 1 ? '' : 's'}`);
    if (edges) parts.push(`${edges} border${edges === 1 ? '' : 's'}`);
    return parts.length ? `Hatched ${parts.join(' and ')} that break a rule` : 'Nothing so far breaks a rule';
  },
  hintDone: 'Already complete.',
  hintNone: 'No further deduction to show.',
  mistakeWall: 'This border is wrong. Remove it and think again.',
  mistakeCells: 'These two cells are not in the same region. Clear the colour and think again.',
  mistakeOther: 'Your marks contradict each other. Try undoing.',
  revealing: 'Showing the solution. Hide it to get your own marks back.',
  warnNoPuzzle: 'No window could be built with these settings. Try another rule combination or difficulty.',
  warnNoRules: 'Pick at least one rule.',
  warnCannotOutline: 'Gemini, Delta and Size Separation cannot stop a region from being split, so on their own they never pin down a single solution. Add Range or Area Number, for example.',
  warnGeminiSizeSep: 'Gemini and Size Separation cannot be combined: the two regions at a Gemini symbol have the same shape and therefore the same area, while Size Separation needs neighbours to differ.',
  h: {
    withNumber: (n: number) => `the region with the number ${n}`,
    withPolyomino: 'the region with the polyomino symbol',
    withSymbol: (glyph: string) => `the region with the ${glyph} symbol`,
    cellAt: (row: number, col: number) => `the cell at row ${row}, column ${col}`,
    ofSize: (n: number) => `the ${n}-cell region`,
    where: (A: string) => `Look around ${A}.`,
    exactly: (n: number) => `${n} cells`,
    atLeast: (n: number) => `at least ${n} cells`,
    needed: 'the required area',
    isBorder: 'This is a border.',
    isSame: 'This cell belongs to the same region.',
    fixedWall: 'This border is pre-drawn.',
    markerWall: 'A marked edge is always a border.',
    sameSymbol: 'No region holds the same symbol twice. This is a border.',
    sizeFull: (A: string, n: number) => `${cap(A)} already has ${n} cells and cannot grow. This is a border.`,
    mergeConflict: (A: string, B: string) => `Joining ${A} with ${B} would break a rule. This is a border.`,
    forcedExit: (A: string) => `${cap(A)} can only grow through this cell. It belongs to the same region.`,
    reachExact: (A: string, target: string) => `${cap(A)} must take every cell it can reach to become ${target}. This cell belongs to the same region.`,
    shapePlaceWall: (A: string) => `However an allowed shape is placed on ${A}, this cell is never part of it. This is a border.`,
    shapePlaceJoin: (A: string) => `However an allowed shape is placed on ${A}, this cell is always part of it. It belongs to the same region.`,
    bifurcationWall: 'Assuming these were one region soon leads to a contradiction. This is a border.',
    bifurcationJoin: 'Assuming a border here soon leads to a contradiction. This cell belongs to the same region.',
    technique: {
      'fixed-wall': 'This border is pre-drawn.',
      'marker-wall': 'A marked edge is a border.',
      'same-symbol': 'Two of the same symbol are never in one region.',
      'size-full': 'This region is already at its largest area.',
      'merge-conflict': 'Joining the two sides would break a rule, so this is a border.',
      'forced-exit': 'This is the only way this region can grow.',
      'reach-exact': 'Reaching the required area takes every reachable cell.',
      'shape-place': 'Placing the allowed shapes settles this cell.',
      bifurcation: 'Assuming the opposite leads to a contradiction.',
    } as Record<string, string>,
  },
};

export const M = lang === 'ko' ? ko : en;

/**
 * Fill static page text: `data-i18n="key"` sets textContent, `data-i18n-title`
 * sets the title attribute, `data-i18n-placeholder` the placeholder. Keys may
 * be nested (`rule.areaNumber`) or indexed (`ctl.3`).
 */
export function applyStatic(root: ParentNode = document): void {
  const lookup = (key: string): string => {
    let cur: unknown = M;
    for (const part of key.split('.')) cur = (cur as Record<string, unknown>)?.[part];
    return typeof cur === 'string' ? cur : key;
  };
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = lookup(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = lookup(el.dataset.i18nTitle!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', lookup(el.dataset.i18nAria!));
  for (const el of root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) el.placeholder = lookup(el.dataset.i18nPlaceholder!);
  document.documentElement.lang = lang;
}
