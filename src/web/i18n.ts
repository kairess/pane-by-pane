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
    ['칠한 칸 두 번 탭', '그 구역 둘레에 경계선'],
    ['칸 사이 탭', '경계선 그리기 · 다시 탭하면 지우기'],
    ['지우개', '드래그로 여러 칸 지우기'],
    ['길게 누르기', '칠한 구역 또는 이어진 빈 칸들의 넓이'],
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
    solitude: '유일',
    boxy: '사각틀',
    nonBoxy: '사각틀 금지',
    inequality: '불평등',
    difference: '넓이의 차이',
    mingle: '어우러진 모양',
    match: '일치',
    mismatch: '불일치',
    palisade: '울타리',
    bricky: '벽돌 무늬',
    loopy: '질긴 고리',
    watchtower: '감시탑',
    fixedWalls: '고정 경계선',
  },
  roseCount: '장미창 기호 수',
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
    solitude: '각 구역은 정확히 하나의 기호(숫자, 폴리오미노)를 포함해야 한다.',
    boxy: '모든 구역은 직사각형이어야 한다.',
    nonBoxy: '어떤 구역도 직사각형이어서는 안 된다.',
    inequality: '부등호 기호 양쪽의 두 구역은 벌어진 쪽의 넓이가 더 커야 한다.',
    difference: '숫자 기호 양쪽의 두 구역은 넓이의 차이가 그 숫자와 같아야 한다. (0이면 같은 넓이)',
    mingle: '이웃한 구역은 서로 다른 형태여야 한다.',
    match: '모든 구역은 서로 같은 형태여야 한다.',
    mismatch: '모든 구역은 서로 다른 형태여야 한다.',
    palisade: '울타리 기호가 있는 칸의 네 변은 기호와 같은 곳에만 경계선이 있어야 한다. (창의 가장자리는 경계선)',
    bricky: '한 꼭짓점에 경계선 네 개가 모여서는 안 된다.',
    loopy: '모든 꼭짓점에 모이는 경계선 수는 0, 2, 4 중 하나여야 한다. 경계선은 끊기거나 갈라지지 않고, 창의 가장자리에 닿지 않는다.',
    watchtower: '감시탑 기호가 있는 꼭짓점 둘레에는 표시된 수만큼의 구역이 있어야 한다.',
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
    solitude: '구역마다 기호 하나',
    boxy: '전부 직사각형',
    nonBoxy: '직사각형 금지',
    inequality: '< 넓이 비교',
    difference: '숫자 = 넓이 차이',
    mingle: '이웃과 모양 다름',
    match: '전부 같은 모양',
    mismatch: '전부 다른 모양',
    palisade: '울타리 = 변',
    bricky: '꼭짓점에 경계선 4개 금지',
    loopy: '경계선 끊김·갈림 금지',
    watchtower: '탑 = 둘레 구역 수',
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
  warnStarsMissedTitle: '요청한 난이도가 아닙니다',
  warnStarsMissed: (lo: number, hi: number, got: number) => `${lo === hi ? `${lo}★` : `${lo}~${hi}★`} 창을 만들지 못해 가장 가까운 ${got}★ 창을 대신 드립니다. 이 규칙 조합과 크기로는 그 난이도가 잘 나오지 않습니다. 크기를 키우거나 규칙을 바꿔 보세요.`,
  warnNoRules: '규칙을 하나 이상 고르세요.',
  warnGeminiSizeSep: '쌍둥이와 넓이 구분은 함께 쓸 수 없습니다. 쌍둥이 기호 양쪽은 모양이 같아 넓이도 같은데, 넓이 구분은 이웃한 구역의 넓이가 달라야 하기 때문입니다.',
  warnRoseSolitude: '장미창과 유일은 함께 쓸 수 없습니다. 유일은 구역마다 기호가 하나뿐이어야 하는데, 장미창은 여러 기호를 요구합니다.',
  warnBoxyNonBoxy: '사각틀과 사각틀 금지는 함께 쓸 수 없습니다.',
  warnSolitudeNeedsSymbols: '유일은 기호가 있어야 합니다. 넓이의 수, 폴리오미노, 울타리 중 하나를 함께 고르세요.',
  warnGeminiMingle: '쌍둥이와 어우러진 모양은 함께 쓸 수 없습니다. 어우러진 모양은 이웃한 구역의 모양이 달라야 하는데, 쌍둥이 기호는 같은 모양을 요구합니다.',
  warnMatchMismatch: '일치와 불일치는 함께 쓸 수 없습니다.',
  warnMatchShapes: '일치는 모든 구역을 같은 모양(같은 넓이)으로 만들므로 어우러진 모양·닮지 않은 둘·넓이 구분·불평등·사각틀 금지와 함께 쓸 수 없습니다.',
  warnMismatchGemini: '불일치와 쌍둥이는 함께 쓸 수 없습니다. 쌍둥이 기호는 같은 모양을 요구합니다.',
  warnLoopyNeedsSize: '질긴 고리만으로는 창을 만들 수 없습니다. 섬 구역을 정하는 규칙(넓이의 수, 넓이의 범위, 도형 창고, 폴리오미노, 장미창, 유일, 울타리, 일치, 사각틀)이 하나 필요합니다.',
  warnBoxyNeedsSize: '사각틀만으로는 창을 만들 수 없습니다. 직사각형은 언제나 둘로 자를 수 있어 넓이를 정하는 규칙(넓이의 수, 넓이의 범위, 도형 창고, 폴리오미노, 장미창, 유일)이 하나 필요합니다.',
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
    oneSymbol: '구역마다 기호는 하나뿐입니다. 이 사이는 경계선입니다.',
    pocketCount: '여기에 경계선을 그으면 잘려 나가는 칸 수로는 구역을 채울 수 없습니다. 이 칸은 같은 구역입니다.',
    boxyFill: (A: string) => `${A}${particle(A, '은', '는')} 직사각형이어야 하므로 모서리 안쪽 칸은 모두 들어갑니다. 이 칸은 같은 구역입니다.`,
    palisade: '울타리 기호가 이 변을 정합니다.',
    mismatchCount: '작은 모양은 이미 다른 구역이 다 썼으므로 이 구역은 둘로 나눌 수 없습니다. 이 칸은 같은 구역입니다.',
    bricky: '한 꼭짓점에 경계선 넷이 모일 수 없습니다. 남은 변은 이어집니다.',
    loopy: '꼭짓점에 모이는 경계선 수는 짝수여야 합니다. 남은 변이 그렇게 정해집니다.',
    watchtower: '감시탑이 보는 구역 수가 이 변을 정합니다.',
    sizeFull: (A: string, n: number) => `${A}${particle(A, '은', '는')} 이미 ${n}칸이라 더 넓어질 수 없습니다. 이 사이는 경계선입니다.`,
    mergeConflict: (A: string, B: string) => `${A}${particle(A, '과', '와')} ${B}${particle(B, '을', '를')} 합치면 규칙에 어긋납니다. 이 사이는 경계선입니다.`,
    forcedExit: (A: string) => `${A}${particle(A, '이', '가')} 더 넓어질 수 있는 곳은 이 칸뿐입니다. 이 칸은 같은 구역입니다.`,
    reachExact: (A: string, target: string) => `${A}${particle(A, '이', '가')} ${target}이 되려면 닿을 수 있는 칸을 전부 써야 합니다. 이 칸은 같은 구역입니다.`,
    shapePlaceWall: (A: string) => `${A}에 허용된 형태를 어떻게 놓아도 이 칸은 들어가지 않습니다. 이 사이는 경계선입니다.`,
    shapePlaceJoin: (A: string) => `${A}에 허용된 형태를 어떻게 놓아도 이 칸은 들어갑니다. 이 칸은 같은 구역입니다.`,
    lookaheadWall: '여기를 이으면 바로 규칙에 어긋납니다. 이 사이는 경계선입니다.',
    lookaheadJoin: '여기에 경계선을 그으면 바로 규칙에 어긋납니다. 이 칸은 같은 구역입니다.',
    bifurcationWall: '여기가 같은 구역이라고 가정하면 곧 모순이 생깁니다. 이 사이는 경계선입니다.',
    bifurcationJoin: '여기에 경계선이 있다고 가정하면 곧 모순이 생깁니다. 이 칸은 같은 구역입니다.',
    technique: {
      'fixed-wall': '미리 그어진 경계선입니다.',
      'marker-wall': '기호가 있는 자리는 경계선입니다.',
      'same-symbol': '같은 기호끼리는 한 구역이 될 수 없습니다.',
      'one-symbol': '구역마다 기호는 하나뿐입니다.',
      'pocket-count': '경계선을 그으면 잘리는 칸 수로는 구역을 채울 수 없습니다.',
      'boxy-fill': '직사각형 구역이므로 모서리 안쪽 칸은 모두 같은 구역입니다.',
      palisade: '울타리 기호가 이 변을 정합니다.',
      'mismatch-count': '작은 모양이 모두 쓰였으므로 이 구역은 더 나눌 수 없습니다.',
      bricky: '한 꼭짓점에 경계선 넷이 모일 수 없습니다.',
      loopy: '꼭짓점의 경계선 수는 짝수여야 합니다.',
      watchtower: '감시탑이 보는 구역 수가 이 변을 정합니다.',
      'size-full': '이 구역은 이미 최대 넓이이므로 더 넓어질 수 없습니다.',
      'merge-conflict': '양쪽을 합치면 규칙에 어긋나므로 경계선입니다.',
      'forced-exit': '이 구역이 더 커질 수 있는 길이 이 한 곳뿐입니다.',
      'reach-exact': '필요한 넓이를 채우려면 닿을 수 있는 칸을 전부 써야 합니다.',
      'shape-place': '허용된 형태를 놓아 보면 여기는 정해져 있습니다.',
      lookahead: '반대로 놓으면 바로 규칙에 어긋납니다.',
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
    ['Double-tap a painted cell', 'border its whole region'],
    ['Tap between cells', 'draw a border · tap again to remove'],
    ['Eraser', 'drag to clear several cells'],
    ['Long-press', 'the area of the painted region, or of the empty cells joined to it'],
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
    solitude: 'Solitude',
    boxy: 'Boxy',
    nonBoxy: 'Non-Boxy',
    inequality: 'Inequality',
    difference: 'Difference',
    mingle: 'Mingle Shape',
    match: 'Match',
    mismatch: 'Mismatch',
    palisade: 'Palisade',
    bricky: 'Bricky',
    loopy: 'Loopy',
    watchtower: 'Watchtower',
    fixedWalls: 'Fixed borders',
  },
  roseCount: 'Rose Window symbols',
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
    solitude: 'Every region contains exactly one symbol (a number or a polyomino tile).',
    boxy: 'Every region is a rectangle.',
    nonBoxy: 'No region is a rectangle.',
    inequality: 'Of the two regions on either side of an inequality sign, the one on its open side has the larger area.',
    difference: 'The two regions on either side of a numbered sign differ in area by exactly that number (0 = equal).',
    mingle: 'Neighbouring regions have different shapes.',
    match: 'Every region has the same shape.',
    mismatch: 'No two regions have the same shape.',
    palisade: 'The four sides of a cell with a palisade tile are borders exactly where the tile shows them (the window\'s edge counts as a border).',
    bricky: 'No vertex has borders on all four of its edges.',
    loopy: 'At every vertex 0, 2 or 4 borders meet: borders never end, never branch, and never touch the frame.',
    watchtower: 'Around a vertex with a watchtower there are exactly as many regions as the tower shows.',
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
    solitude: 'one symbol per region',
    boxy: 'all rectangles',
    nonBoxy: 'no rectangles',
    inequality: '< compare areas',
    difference: 'number = area difference',
    mingle: 'neighbours differ in shape',
    match: 'all one shape',
    mismatch: 'all different shapes',
    palisade: 'tile = sides',
    bricky: 'no 4-border vertex',
    loopy: 'borders never end or branch',
    watchtower: 'tower = regions around it',
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
  warnStarsMissedTitle: 'Not the difficulty you asked for',
  warnStarsMissed: (lo: number, hi: number, got: number) => `No ${lo === hi ? `${lo}★` : `${lo}–${hi}★`} window could be built, so here is the closest one at ${got}★. This rule set and size rarely reach that difficulty. Try a larger window or other rules.`,
  warnNoRules: 'Pick at least one rule.',
  warnGeminiSizeSep: 'Gemini and Size Separation cannot be combined: the two regions at a Gemini symbol have the same shape and therefore the same area, while Size Separation needs neighbours to differ.',
  warnRoseSolitude: 'Rose Window and Solitude cannot be combined: Solitude allows one symbol per region, a rose window asks for several.',
  warnBoxyNonBoxy: 'Boxy and Non-Boxy cannot be combined.',
  warnSolitudeNeedsSymbols: 'Solitude needs symbols to count: add Area Number, Polyomino or Palisade.',
  warnGeminiMingle: 'Gemini and Mingle Shape cannot be combined: Mingle needs neighbouring regions to differ in shape, a Gemini symbol asks for the same shape.',
  warnMatchMismatch: 'Match and Mismatch cannot be combined.',
  warnMatchShapes: 'Match makes every region the same shape and size, so it cannot go with Mingle, Delta, Size Separation, Inequality or Non-Boxy.',
  warnMismatchGemini: 'Mismatch and Gemini cannot be combined: a Gemini symbol asks for the same shape.',
  warnLoopyNeedsSize: 'Loopy alone cannot make a window: a rule that pins the islands is needed (Area Number, Range, Shape Bank, Polyomino, Rose Window, Solitude, Palisade, Match or Boxy).',
  warnBoxyNeedsSize: 'Boxy alone cannot make a window: a rectangle can always be cut in two, so a rule that fixes areas is needed (Area Number, Range, Shape Bank, Polyomino, Rose Window or Solitude).',
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
    oneSymbol: 'Every region holds exactly one symbol. This is a border.',
    pocketCount: 'A border here would cut off a pocket that no whole regions could fill. This cell belongs to the same region.',
    boxyFill: (A: string) => `${cap(A)} must be a rectangle, so every cell inside its corners belongs to it. This cell belongs to the same region.`,
    palisade: 'The palisade tile fixes this side.',
    mismatchCount: 'Every small shape is already taken by another region, so this region cannot be cut in two. This cell belongs to the same region.',
    bricky: 'Four borders cannot meet at one vertex, so the last edge joins.',
    loopy: 'An even number of borders meet at every vertex; that settles this edge.',
    watchtower: 'The number of regions the watchtower sees settles this edge.',
    sizeFull: (A: string, n: number) => `${cap(A)} already has ${n} cells and cannot grow. This is a border.`,
    mergeConflict: (A: string, B: string) => `Joining ${A} with ${B} would break a rule. This is a border.`,
    forcedExit: (A: string) => `${cap(A)} can only grow through this cell. It belongs to the same region.`,
    reachExact: (A: string, target: string) => `${cap(A)} must take every cell it can reach to become ${target}. This cell belongs to the same region.`,
    shapePlaceWall: (A: string) => `However an allowed shape is placed on ${A}, this cell is never part of it. This is a border.`,
    shapePlaceJoin: (A: string) => `However an allowed shape is placed on ${A}, this cell is always part of it. It belongs to the same region.`,
    lookaheadWall: 'Joining here breaks a rule at once. This is a border.',
    lookaheadJoin: 'A border here breaks a rule at once. This cell belongs to the same region.',
    bifurcationWall: 'Assuming these were one region soon leads to a contradiction. This is a border.',
    bifurcationJoin: 'Assuming a border here soon leads to a contradiction. This cell belongs to the same region.',
    technique: {
      'fixed-wall': 'This border is pre-drawn.',
      'marker-wall': 'A marked edge is a border.',
      'same-symbol': 'Two of the same symbol are never in one region.',
      'one-symbol': 'Every region holds exactly one symbol.',
      'pocket-count': 'A border here would cut off cells no whole regions could fill.',
      'boxy-fill': 'A rectangular region takes every cell inside its corners.',
      palisade: 'The palisade tile fixes this side.',
      'mismatch-count': 'Every small shape is taken, so this region cannot be cut.',
      bricky: 'Four borders cannot meet at one vertex.',
      loopy: 'An even number of borders meet at every vertex.',
      watchtower: 'The watchtower\'s count settles this edge.',
      'size-full': 'This region is already at its largest area.',
      'merge-conflict': 'Joining the two sides would break a rule, so this is a border.',
      'forced-exit': 'This is the only way this region can grow.',
      'reach-exact': 'Reaching the required area takes every reachable cell.',
      'shape-place': 'Placing the allowed shapes settles this cell.',
      lookahead: 'The opposite breaks a rule at once.',
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
